const redis = require('redis')
  , client = redis.createClient()
  , subscriber = redis.createClient()
  , utils = require('./redisProtocolUtils')
  , moment = require('moment')
  , HashMap = require('hashmap')
  , InstaWorker = require('./models/InstaWorker');

var tasks = new HashMap() //TASKID - { cb: resolve with data, at: time sent }
  , bots = new HashMap(); //BOTID - { at: TIMEPINGED, username }
  , accounts = new HashMap(); //USERNAME - { username, password, proxyURL?, device? }


(new Promise((res, err) => {
	mongoose.connect('mongodb://cole:test123@ds129560.mlab.com:29560/clouthack', error => {
    	if (error)
    		return err(error);
    
    	res(console.log('Connected to Mongo'));
    });
})).then(() => InstaWorker.find({}).exec().then(arr => {
	console.log(`DB Has ${arr.length} Accounts`);

	//redis ordered set 'bots:ig' stores botids scored by time they last did a job
    redis.add_command('zpopmin');
    client.del('bots:ig');
    client.del('accounts:ig');
    client.del('usedaccounts:ig');
    subscriber.subscribe('bot:ig');
    subscriber.subscribe('data:ig');

    //redis set accounts:ig stores accounts available to new bots
    for (var i = 0; i < arr.length; i++) {
    	const acct = JSON.stringify(arr[i]);
    	accounts.set(acct.username, acct);
		client.sadd('accounts:ig', acct);
    }

    subscriber.on('message', (channel, message) => {
    	switch (channel) {
    		case 'bot:ig':
    		    const [ botId, lastTask, username ] = utils.split(message, ':', 3);
    		    addBot(botId, lastTask, username).catch(console.log);
    		    break;
    		case 'data:ig':
    		    callbackWithData(message);
    		    break;
    	}
    });
    
    //checks for stale tasks every 2 seconds, which are considered stale after 5
    setInterval(() => {
    	tasks.forEach((val, taskId) => {
    		if (val.at < moment() - 5000 && !val.staleTaskId) {
    			const task = utils.split(taskId, ':', 2)[1];
    			console.log(`Stale task ${task}, redelegating`);
    			val.isStale = true;
    			delegateTask(task, val.cb, taskId);
    		}
    	});
    }, 2000);

    //bots send update every 5 seconds, and are given 1 second of leeway
    //script checks for dead bots every 5 seconds
    setInterval(() => {
    	bots.forEach((val, key) => {
    		if (val.at < moment() - 6000) {
    			client.smove('usedaccounts:ig', 'accounts:ig', accounts.get(val.username), (err, res) => {
    				if (err)
    					console.error(err.message);
    				else if (!res)
    					console.error('Dead Bot Not A Used Account?');
    				else {
    					console.log(`Bot ${key} Not Responsive, Reclaiming Account`);
    			        client.zrem('bots:ig', key);
    			        //botId is set in bots iff their username is in usedaccounts:ig
    			        bots.delete(key);
    				}
    			});
    		}
    	});
    }, 5000);
    
    //actually delete the stale tasks every minute
    //(don't initially delete because they could still callback with data)
    setInterval(() => {
    	tasks.forEach((val, key) => {
    		if (val.isStale && val.at < moment() - 10000)
    			tasks.delete(key);
    	});
    }, 60000);
});


function callbackWithData(message) {
	if (!message.includes('::')) { //no :: means error on worker side
		tasks.delete(message);
		return taskPromise(utils.split(message, ':', 2)[1]);
	}

	const [ taskId, data ] = utils.split(message, '::', 2),
          task = tasks.get(taskId);
    if (task) {
    	task.cb(JSON.parse(data));
    	console.log(`Task ${taskId} completed`);
    	tasks.delete(taskId);
    	if (task.staleTaskId)
    		deleteStaleTasks(staleTaskId);
    } else
        console.log(`Task ${taskId} not found`);
}

function deleteStaleTasks(id) {
	const task = tasks.get(id);
	if (task) {
		tasks.delete(id);
		if (task.staleTaskId)
			deleteStaleTasks(task.staleTaskId);
	}
}


//bot notifies every 30 seconds
function addBot(botId, lastTask, username) {
	var bot = bots.get(botId);

	return bot ? Promise.resolve(bot.at = moment()) : Promise.all([new Promise((res, err) => {
		console.log(`New Bot ${botId} Using Client ${username}`);

	    client.zadd('bots:ig', parseInt(lastTask), botId, (er, rs) => {
	    	if (er)
	    		return err(er);
	    	res();
	    });
    }), new Promise((res, err) => {
    	client.smove('accounts:ig', 'usedaccounts:ig', accounts.get(username), (er, rs) => {
    		if (er)
    			return err(er);
    		else if (!rs)
    			return err('Bot Account Already Used?');

    		//botId is set in bots iff their username is in usedaccounts:ig
    		bots.set(botId, { at: moment(), username });
    		res();
    	});
    })]);
}

function getBot() {
	return new Promise((res, err) => {
		client.zpopmin('bots:ig', (er, rs) => {
			if (er)
				return err(er);
			else if (rs.length < 2)
				return err('No available bots, waiting');
			rs = rs[0];
			console.log(`Got bot ${rs}`);
			res(rs);
		});
	});
}

function delegateTask(task, cb, staleTaskId) {
	getBot().then(botId => {
	    const taskId = `${botId}:${task}`;
	    var taskData = { at: moment(), cb };
	    if (staleTaskId)
	    	taskData.staleTaskId = staleTaskId;

	    tasks.set(taskId, taskData);
	    client.publish('tasks:ig', taskId);
	    console.log(`Task ${taskId} delegated`);
	}).catch((er) => {setTimeout(() => delegateTask(task, cb), 1000);console.log(er);});
}

//taskId = BOTID:TASKCODE:ACCOUNTID/HANDLE:[CURSOR]
function taskPromise(task) {
	return new Promise((res, err) => delegateTask(task, res));
}

function getProfileById(id) {
    return taskPromise(`gp:${id}`);
}

function getProfileByHandle(handle) {
	return taskPromise(`gi:${handle}`);
}

function getFollowers(id, cursor) {
	return taskPromise(`gf:${id}:${cursor || ' '}`);
}

function getMedia(id, cursor) {
	return taskPromise(`gm:${id}:${cursor || ' '}`);
}

const test = () => getProfileByHandle('coltranetunes').then(id => {
	console.log(`Got id ${id}`);
	getProfileById(id).then(console.log);
	getFollowers(id).then(console.log);
});

module.exports = { getProfileById, getProfileByHandle, getFollowers, getMedia };