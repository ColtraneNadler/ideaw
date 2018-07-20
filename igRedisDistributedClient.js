const redis = require('redis')
  , client = redis.createClient()
  , subscriber = redis.createClient()
  , utils = require('redisProtocolUtils');

var tasks = new (require('hashmap'))();




subscriber.subscribe('ready:ig');

subscriber.on('message', (channel, message) => {
	switch (channel) {
		case 'bot:ig':
		    addBot(message).catch(console.log);
		    break;
		case 'data:ig':
		    callbackWithData(message);
		    break;
	}
});

//script removes dead bots every 2 seconds
setInterval(() => client.zremrangebyscore(0, Date.now()), 2000);

//checks for stale tasks every 2 seconds, which are stale after 3
setInterval(() => {
	tasks.forEach((val, key) => {
		if (val.at < Date.now() - 3000) {
			tasks.delete(key);
			delegateTask(key, val.cb);
		}
	});
}, 2000);







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
    } else
        console.log(`Task ${taskId} not found`);
}


//bot notifies every 30 seconds
function addBot(id) {
	return new Promise((res, err) => {
	    client.zadd('bots:ig', Date.now() + 5 * 1000, (er, rs) => {
	    	if (er)
	    		err(er);
	    	res();
	    });
    });
}

function getBot() {
	return new Promise((res, err) => {
		client.bzpopmin('bots:ig', (er, rs) => {
			if (er)
				err(er);
			res(rs);
		});
	});
}

//taskId = BOTID:TASKCODE:ACCOUNTID/HANDLE:[CURSOR]
function taskPromise(task) {
	return new Promise((res, err) => {
		getBot().then(botId => {
		    var fullTask = `${botId}:${task}`;
	        client.publish('tasks:ig', fullTask);
	        tasks.set(fullTask, { at: Date.now(), cb: res });
	    }).catch(() => taskPromise(task, cb));
	});
}

function getProfileById(id) {
    return taskPromise(`gp:${id}`);
}

function getIdByHandle(handle) {
	return taskPromise(`gi:${handle}`);
}

function getFollowers(id, cursor) {
	return taskPromise(`gf:${id}:${cursor}`);
}

function getMedia(id, cursor) {
	return taskPromise(`gm:${id}:${cursor}`);
}
