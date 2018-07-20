var redis = require('redis')
  , subscriber = redis.createClient()
  , client = redis.createClient(),
  , API = require('instagram-private-api').V1
  , pid //unique
  , session //ig session
  //this is a hack, need a better way to get credentials
  , temp1 = require('./config').igAccounts,
  , temp2 = temp1[Math.floor(Math.random()*temp1.length)]
  , mongoose = require('mongoose');

temp2.device = 'chrome';

const settings = temp2
    , temp = require('./config').igAccounts,
    , settings = temp[Math.floor(Math.random()*temp.length)],
    , pid = guid();

var mongoPromise = new Promise((res, err) => {
	mongoose.connect('mongodb://cole:test123@ds129560.mlab.com:29560/clouthack', error => {
    	if (error)
    		return err(error);
    
    	res(console.log('Connected to Mongo'));
    });
}), storage = new api.CookieFileStorage('./cookies/' + settings.username + '_cookies.json');

Promise.all([API.Session.create(new api.Device(settings.device), storage, settings.username, settings.password, settings.proxyURL || undefined), mongoPromise]).then(data => {

    session = data[0];
    var interval = {},
        unready = () => interval.val && clearInterval(interval.val),
        ready = () => interval.val = setInterval(() => client.publish('ready:ig', pid), 5000);

    console.log(`Client ${username} Session Initialized`);
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
                getFollowers(args[2], args[3], message);
                break;
            case 'gm':
                getMedia(args[2], args[3], message);
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
    }).catch(() => client.publish('data:ig', taskId));
}

function getIdByHandle(handle, taskId) {
    API.Account.searchForUser(session, handle).then(user => {
        const id = user.id;
        console.log(`${handle} has id ${id}`);
        client.publish('data:ig', `${taskId}::${id}`);
    }).catch(() => client.publish('data:ig', taskId));
}

function getFollowers(id, cursor, taskId) {
    const feed = new API.Feed.AccountFollowers(session, id);
    feed.cursor = cursor;
    feed.get().then(followers => {
        var arr = [];

        for (var i = 0; i < followers.length; i++) {
            let cur = followers[i]._params;
            arr.push({
                handle: cur.username,
                igId: cur.id,
                name: cur.fullName,
                private: cur.isPrivate,
                verified: cur.isVerified,
            });
        }

        client.publish('data:ig', `${taskId}::${JSON.stringify({
            arr,
            cursor: feed.moreAvailable && feed.cursor
        })}`);

        console.log(`Loaded ${arr.length} Followers of ${id}`);
    }).catch(() => client.publish('data:ig', taskId));
}

function getMedia(id, cursor, taskId) {
    const feed = API.Feed.UserMedia.get(session, id, 10);
    feed.cursor = cursor;
    feed.get().then(data => {

    });
}

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}