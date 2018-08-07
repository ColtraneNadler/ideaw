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
    , account
    , moment = require('moment')
    , fs = require('fs')
    , MS_PER_TASK = 1500;


var mongoPromise = () => new Promise((res, err) => {
	mongoose.connect('mongodb://cole:test123@ds129560.mlab.com:29560/clouthack', error => {
    	if (error)
    		return err(error);
    
    	res(console.log('Connected to Mongo'));
    });
}), accountPromise = () => new Promise((res, err) => {
        client.srandmember('accounts:ig', (er, rs) => {
            if (er)
                return err(er);
            else if (!rs)
                return err('No Available Accounts');
    
            rs = JSON.parse(rs);
            console.log(`Got Account ${rs.username}`);
            res(rs);
        });
}), storage = () => new API.CookieFileStorage(`./cookies/${account.username}_cookies.json`)
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
        client.publish('bot:ig', `${pid}:${lastTask}:${account.username}`);
        console.log('Ready');
    }, MS_PER_TASK)
  , handleError = taskId => err => {
        console.log(err && err.message);
        client.publish('data:ig', taskId);
        ready();
    };

(function start() {
    accountPromise().then(acct => {
        account = acct;
        return API.Session.create(new API.Device(acct.device || 'chrome'), storage(), acct.username, acct.password, acct.proxyURL || undefined).then(sesh => {
            session = sesh;

            console.log(`Client ${acct.username} Session Initialized`);
            subscriber.on('message', (channel, message) => {
                var args = message.split(':');
                if (args.length < 3 || args[0] !== pid)
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
        });
    }).catch(err => {
        console.log(err && err.message);
        fs.writeFileSync(`./cookies/${account.username}_cookies.json`, '');
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
                console.log(`${handle} Has ID ${data.id}`);
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