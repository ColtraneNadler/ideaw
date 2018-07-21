const redis = require('redis')
  , client = redis.createClient()
  , subscriber = redis.createClient()
  , utils = require('./redisProtocolUtils')
  , moment = require('moment')
  , HashMap = require('hashmap');

var tasks = new HashMap() //TASKID - { cb: resolve with data, at: time sent }
  , bots = new HashMap(); //BOTID - TIMEPINGED

//redis ordered set 'bots:ig' stores botids scored by time they last did a job
redis.add_command('zpopmin');
subscriber.subscribe('bot:ig');
subscriber.subscribe('data:ig');

subscriber.on('message', (channel, message) => {
	switch (channel) {
		case 'bot:ig':
		    const [ botId, lastTask ] = utils.split(message, ':', 2);
		    addBot(botId, lastTask).then(() => console.log(`New bot ${botId}`), console.log);
		    break;
		case 'data:ig':
		    callbackWithData(message);
		    break;
	}
});

//bots send update every 5 seconds
//script removes dead bots every 2 seconds
// setInterval(() => client.zremrangebyscore('bots:ig', 0, moment() - 6000), 2000);
setInterval(() => {
	bots.forEach((val, key) => {
		if (val < moment() - 5300) {
			bots.delete(key);
			client.zrem('bots:ig', key);
		}
	});
}, 2000);

//checks for stale tasks every 2 seconds, which are considered stale after 5
setInterval(() => {
	tasks.forEach((val, taskId) => {
		if (val.at < moment() - 5000 && !val.staleTaskId) {
			const task = utils.split(taskId, ':', 2)[1];
			console.log(`Stale task ${task}, redelegating`);
			delegateTask(task, val.cb, taskId);
		}
	});
}, 2000);

//actually delete the stale tasks every minute
//(don't initially delete because they could still callback with data)
setInterval(() => {
	tasks.forEach((val, key) => {
		if (val.at < moment() - 5000)
			tasks.delete(key);
	});
}, 60000);






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
function addBot(botId, lastTask) {
	bots.set(botId, moment());

	return new Promise((res, err) => {
	    client.zadd('bots:ig', parseInt(lastTask), botId, (er, rs) => {
	    	if (er)
	    		return err(er);
	    	res();
	    });
    });
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
	}).catch((er) => {setTimeout(() => delegateTask(task, cb), 5000);console.log(er);});
}

//taskId = BOTID:TASKCODE:ACCOUNTID/HANDLE:[CURSOR]
function taskPromise(task) {
	return new Promise((res, err) => delegateTask(task, res));
}

function getProfileById(id) {
    return taskPromise(`gp:${id}`);
}

function getIdByHandle(handle) {
	return taskPromise(`gi:${handle}`);
}

function getFollowers(id, cursor) {
	return taskPromise(`gf:${id}:${cursor || ' '}`);
}

function getMedia(id, cursor) {
	return taskPromise(`gm:${id}:${cursor || ' '}`);
}

const test = () => getIdByHandle('coltranetunes').then(id => {
	console.log(`Got id ${id}`);
	getProfileById(id).then(console.log);
	getFollowers(id).then(console.log);
});

module.exports = { getProfileById, getIdByHandle, getFollowers, getMedia };