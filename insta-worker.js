var redis = require('redis')
  , subscriber = redis.createClient()
  , client = redis.createClient()
  , API = require('instagram-private-api').V1
  , session //ig session
  //this is a hack, need a better way to get credentials
  , mongoose = require('mongoose')
  , IgCache = require('./models/IgCache');

const temp = require('./config').igAccounts
    , settings = temp[Math.floor(Math.random()*temp.length)]
    , pid = guid()
    , moment = require('moment')
    , fs = require('fs');

settings.device = 'chrome';

var mongoPromise = new Promise((res, err) => {
	mongoose.connect('mongodb://cole:test123@ds129560.mlab.com:29560/clouthack', error => {
    	if (error)
    		return err(error);
    
    	res(console.log('Connected to Mongo'));
    });
}), storage = new API.CookieFileStorage('./cookies/' + settings.username + '_cookies.json')
  , lastTask = +moment()
  , interval = {}
  , unready = () => {
        lastTask = +moment();
        if (interval.val) {
            clearInterval(interval.val);
            interval.val = undefined;
        }
    }
  , ready = () => interval.val = setInterval(() => {
        client.publish('bot:ig', `${pid}:${lastTask}`);
        console.log('Ready');
    }, 5000)
  , handleError = taskId => err => {
        console.log(err && err.message);
        client.publish('data:ig', taskId);
        ready();
    };

(function start() {
    Promise.all([API.Session.create(new API.Device(settings.device), storage, settings.username, settings.password, settings.proxyURL || undefined), mongoPromise]).then(data => {
    
        session = data[0];
    
        console.log(`Client ${settings.username} With ID ${pid} Session Initialized`);
        subscriber.on('message', (channel, message) => {
    	    var args = message.split(':');
    	    if (args.length < 3 || args[0] != pid)
    	    	return;
    
          //taskId = BOTID:TASKCODE:ACCOUNTID/HANDLE:[CURSOR]
    	    unready();
            console.log(`Executing Task: ${message}`);
            switch (args[1]) {
                case 'gp': //get profile
                    getProfileById(args[2], message);
                    break;
                case 'gi': //get id
                    getProfileByHandle(args[2], message);
                    break;
                case 'gf':
                    getFollowers(args[2], args[3] !== ' ' && args[3], message);
                    break;
                case 'gm':
                    getMedia(args[2], args[3] !== ' ' && args[3], message);
                    break;
            }
        });
    
        subscriber.subscribe('tasks:ig');
        ready();
    }).catch(err => {
        console.log(err && err.message);
        fs.writeFileSync('./cookies/' + settings.username + '_cookies.json', '');
        start();
    });
})();

function getProfileById(id, taskId) {
    IgCache.findOne({
        _id : id
    }).exec().then(data => {

        if (data) {
            console.log(`${id} Has ${data.followers} Followers`);
            client.publish('data:ig', `${taskId}::${JSON.stringify(data)}`);
            ready();
        } else
            API.Account.getById(session, id).then(data => {
                console.log(`${id} Has ${data.params.followerCount} Followers`);
                var entry = {
                    username: data.params.username,
                    followers: data.params.followerCount,
                    verified: data.params.isVerified,
                    avatarUrl: data.params.profilePicUrl,
                    _id: data.id,
                    displayName: data.params.fullName
                }
                  , doc = new IgCache(entry);

                client.publish('data:ig', `${taskId}::${JSON.stringify(entry)}`);
                doc.save(err => err && console.log(err));
                ready();
            }).catch(handleError(taskId));
    }).catch(handleError(taskId));
}

function getProfileByHandle(handle, taskId) {
    IgCache.findOne({
        username: handle
    }).exec().then(data => {

        if (data) {
            console.log(`${handle} Has ${data.followers} Followers`);
            client.publish('data:ig', `${taskId}::${JSON.stringify(data)}`);
            ready();
        } else
            API.Account.searchForUser(session, handle).then(data => {
                console.log(`${handle} has id ${data.id}`);
                var entry = {
                    username: data.params.username,
                    followers: data.params.followerCount,
                    verified: data.params.isVerified,
                    avatarUrl: data.params.profilePicUrl,
                    _id: data.id,
                    displayName: data.params.fullName
                }
                  , doc = new IgCache(entry);
                client.publish('data:ig', `${taskId}::${JSON.stringify(entry)}`);
                doc.save(err => err && console.log(err));
                ready();
            }).catch(handleError(taskId));
    }).catch(handleError(taskId));
}

function getFollowers(id, cursor, taskId) {
    const feed = new API.Feed.AccountFollowers(session, id);
    if (cursor) feed.cursor = cursor;
    feed.get().then(followers => {
        console.log('got feed');
        var arr = followers.map(cur => {
            cur = cur._params;
            return {
                handle: cur.username,
                id: cur.id,
                name: cur.fullName,
                private: cur.isPrivate,
                verified: cur.isVerified,
            };
        });

        client.publish('data:ig', `${taskId}::${JSON.stringify({
            arr,
            cursor: feed.moreAvailable && feed.cursor
        })}`);

        console.log(`Loaded ${arr.length} Followers of ${id}`);
        ready();
    }).catch(handleError(taskId));
}

function getMedia(id, cursor, taskId) {
    const feed = new API.Feed.UserMedia(session, id, 10);
    if (cursor) feed.cursor = cursor;
    feed.get().then(data => client.publish('data:ig', `${taskId}::${JSON.stringify(data)}`)).catch(handleError(taskId));
}

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}