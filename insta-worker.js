var redis = require('redis')
  , subscriber = redis.createClient()
  , client = redis.createClient()
  , API = require('instagram-private-api').V1
  , session //ig session
  //this is a hack, need a better way to get credentials
  , mongoose = require('mongoose');

const temp = require('./config').igAccounts
    , settings = temp[Math.floor(Math.random()*temp.length)]
    , pid = guid()
    , moment = require('moment');

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
  , ready = () => interval.val = setInterval(() => client.publish('bot:ig', `${pid}:${lastTask}`), 5000);


Promise.all([API.Session.create(new API.Device(settings.device), storage, settings.username, settings.password, settings.proxyURL || undefined), mongoPromise]).then(data => {

    session = data[0];

    console.log(`Client ${settings.username} Session Initialized`);
    subscriber.on('message', (channel, message) => {
	    var args = message.split(':');
	    if (args.length < 3 || args[0] !== pid)
	    	return;

      //taskId = BOTID:TASKCODE:ACCOUNTID/HANDLE:[CURSOR]
	    unready();
        switch (args[1]) {
            case 'gp': //get profile
                getProfileById(args[2], message);
                break;
            case 'gi': //get id
                getIdByHandle(args[2], message);
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
});

function getProfileById(id, taskId) {
    API.Account.getById(session, id).then(data => {
        data = data.params;
        console.log(`${id} Has ${data.followerCount} Followers (From Client ${client.clientId})`);
        client.publish('data:ig', `${taskId}::${JSON.stringify({
            handle: data.username,
            followerNum: data.followerCount,
            bio: data.biography,
            verified: data.isVerified,
            isBusiness: data.isBusiness,
            externalUrl: data.externalUrl,
            profilePic: data.profilePicUrl,
            followingNum: data.followingCount,
            _id: id,
            name: data.fullName,
            email: data.publicEmail,
            publicPhone: data.publicPhoneNumber,
            contactPhone: data.contactPhoneNumber
        })}`);
        ready();
    }).catch(() => {client.publish('data:ig', taskId);ready();});
}

function getIdByHandle(handle, taskId) {
    API.Account.searchForUser(session, handle).then(user => {
        const id = user.id;
        console.log(`${handle} has id ${id}`);
        client.publish('data:ig', `${taskId}::${id}`);
        ready();
    }).catch(() => {client.publish('data:ig', taskId);ready();});
}

function getFollowers(id, cursor, taskId) {
    const feed = new API.Feed.AccountFollowers(session, id);
    if (cursor) feed.cursor = cursor;
    feed.get().then(followers => {
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
    }).catch(() => {client.publish('data:ig', taskId);ready();});
}

function getMedia(id, cursor, taskId) {
    const feed = API.Feed.UserMedia.get(session, id, 10);
    feed.cursor = cursor;
    feed.get().then(data => client.publish('data:ig', `${taskId}::${JSON.stringify(data)}`));
}

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}