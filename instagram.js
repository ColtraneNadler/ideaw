'use strict';

let fs = require('fs');

if (!fs.existsSync('cookies'))
    fs.mkdirSync('cookies');

let Client    = require('instagram-private-api').V1
    , clearCookies = client => fs.writeFileSync('./cookies/' + client.username + '_cookies.json', '')
    , clients = []
    , api = {};

const Profile = new require('./models/Profile')()
    , Instagram = new require('./models/Instagram')()
    , InstagramSnapshot = require('./models/InstagramSnapshot')
    , msPerRequestsPerClient = 300; //ms which must have passed since last request was received

//returns a promise which is resolved upon init

// Proxy URL has a standard format:
// Unauthenticated: http(s)://yourhost.com/
// Authenticated: http(s)://user:pass@yourhost.com/
api.addClient = function (username, password, deviceString, proxyURL) {

    var device = new Client.Device(deviceString),
        storage = new Client.CookieFileStorage('./cookies/' + username + '_cookies.json');

    return Client.Session.create(device, storage, username, password, proxyURL || undefined).then(session => {
        console.log(`Client ' ${username}' Session Initialized`);
        clients.push({
            clientId: clients.length,
            device,
            storage,
            session,
            username,
            busy: false, //busy after request until msPerRequestPerClient has been waited
            lastRequestMs: -1, //time last request was received (not sent)
            queue: [] //callback once request is done and time is waited
        });
    });
}

//returns promise with client object, optionally takes in callback to be given client object next time
//must have freeClient called on the available client
api.getAvailableClient = () => {
    return new Promise((res, err) => {
        if (clients.length === 0)
            return err('No Client Sessions');

        (function waitForClient() {
            for (var i = 0; i < clients.length; i++) {
                var client = clients[i];
                if (!client.busy) {
                    client.busy = true;
                    var now = Date.now(),
                        elapsed = now - client.lastRequestMs;

                    if (elapsed >= msPerRequestsPerClient)
                        return res(client);
                    else
                        return setTimeout(() => res(client), msPerRequestsPerClient - elapsed);
                }
            }
            console.log('All Clients Busy, Waiting 500 For Free Client');
            setTimeout(waitForClient, 500);
        })();
    });
}

api.freeClient = client => {
    client.lastRequestMs = Date.now();

    setTimeout(() => {
        client.busy = false;
        if (client.queue.length > 0 && typeof client.queue[0] === 'function')
            client.queue.shift()(client);
    }, msPerRequestsPerClient);
}

//if given a session, the client passed is freed
//if given no session, the client gotten is freed
api.getProfileById = (id, cli, numFollowersToLoad) => {

    function get(client) {
        return Client.Account.getById(client.session, id).then(data => {
            data = data.params;
            console.log(`${id} Has ${data.followerCount} Followers (From Client ${client.clientId})`);
            var res = {
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
            };
            if (!numFollowersToLoad)
                return res;

            let feed = new Client.Feed.AccountFollowers(client.session, id);
            api.freeClient(client);
            feed.map = cur => {
                return {
                    handle: cur._params.username,
                    _id: cur.id,
                    name: cur._params.fullName,
                    private: cur._params.isPrivate,
                    verified: cur._params.isVerified,
                };
            };
            //feed.reduce to only store the good ones

            return api.balancedLoadFeed(feed, 10, isNaN(numFollowersToLoad) ? 30000 : numFollowersToLoad).then(arr => {
                res.followers = arr;
                console.log('has: ' + arr.length + ' followers');
                return res;
            });
        });
    }
    return cli ? get(cli) : api.getAvailableClient().then(get);
}

api.getCumulativeSnapshot = profile => {
    console.log('ohhhhh');
    return InstagramSnapshot.find({ _id: profile._id }).exec().then(snaps => {
        console.log('yoooooo');
        var followers = [],
            engagements = [],
            followersSeen = '',
            likesSeen = '',
            lastSnap;
        for (var i = 0; i < snaps.length; i++) {
            var curEng = snaps[i].notableEngagements,
                curFol = snaps[i].notableFollowers;
            for (var j = 0; j < curFol.length; j++) {
                var cur = curFol[j];
                if (!followersSeen.includes(cur)) {
                    followers.push(cur);
                    followersSeen += cur;
                }
            }
            for (j = 0; j < curEng.length; j++) {
                var cur = curEng[j];
                if (!engagementsSeen.includes(cur._id)) {
                    engagements.push(cur);
                    engagements += cur._id;
                }
            }
            if (i === snaps.length - 1) lastSnap = snaps[i];
        }

        console.log(snaps);

        if (!lastSnap)
            return Error(`No Snapshots Stored For ${profile._id}`);

        return {
            createdAt: lastSnap.createdAt,
            followers: lastSnap.followers,
            averageLikes: lastSnap.averageLikes,
            averageComments: lastSnap.averageComments,
            notableEngagements: engagements,
            notableFollowers: followers
        };
    });
}

//feedLimit is how many
api.getSnapshot = (profile, feedLimit) => {
    return Promise.all([api.getAvailableClient(), api.getCumulativeSnapshot(profile)]).then(data => {
        console.log('data', data);
        var [ client, snap ] = data,
            feed = Client.Feed.UserMedia.get(client.session, profile._id, 10);
        return feed.get().then(media => {
            for (var i = 0; i < media.length && i < 10; i++) {
                console.log(media[i]);
            }
        });
    });
}

//returns a promise resolved with the profile info, including the followers
api.getProfileByHandle = (handle, numFollowersToLoad) => {

    return api.getAvailableClient().then(client => {
        return Client.Account.searchForUser(client.session, handle).then(user => {
            console.log(`${handle}'s User ID: ${user.id}`);
    
            api.freeClient(client);
            return api.getProfileById(user.id, client, numFollowersToLoad);
        });
    });
}

api.balancedLoadFeed = (feed, maxErrors, maxLength) => {
    return new Promise((res, err) => {
        var errors = 0,
            feedArr = [];

        //recursively load followers into info, resolving promise upon completion
        (function scroll() {
            console.log(`Have Loaded ${feedArr.length} Elements Of Feed`);

            api.getAvailableClient().then(client => {
                console.log(`Using Client ${client.clientId}`);
                feed.session = client.session;
                feed.get().then(followers => {
                    for (var i = 0; i < followers.length; i++) {
                        let cur = followers[i]._params;
                        feedArr.push({
                            handle: cur.username,
                            igId: cur.id,
                            name: cur.fullName,
                            private: cur.isPrivate,
                            verified: cur.isVerified,
                        });
                    }
                    api.freeClient(client);

                    if (feed.moreAvailable && feedArr.length < maxLength) {
                        if (!client.busy) client.busy = true;
                        scroll();
                    } else {
                        console.log(`Loaded ${feedArr.length} Elements Of Feed`);
                        res(feedArr);
                    }
                }, (error) => {
                    api.freeClient(client);
                    errors++;
                    if (error.message)
                        console.log(`Error #${errors} Getting Feed: ${error.message}`);

                    if (errors <= maxErrors && feed.moreAvailable)
                        scroll();
                    else 
                        err(error);
                });
            });
        })();
    });
}

//destructive to original array, like array map
api.mapIdsToAccounts = (arrContainingIds, elemToId, maxErrors, maxLength) => {
    return new Promise((res, err) => {
        var curIndex = { val: 0 },
            len = arrContainingIds.length,
            errors = 0;
    
        function onAvailableClient(client) {
            var nextIndex = curIndex.val;
            if (nextIndex < len && nextIndex < maxLength) {
                curIndex.val = nextIndex + 1;
                var id = elemToId(arrContainingIds[nextIndex]);
                console.log(`Getting Profile With Id: ${id}`);
                api.getProfileById(id, client).then(profile => {
                    arrContainingIds[nextIndex] = profile;
                    api.freeClient(client);
                    client.queue.push(onAvailableClient);
                }).catch((error) => {
                    api.freeClient(client);
                    errors++;
                    if (error.message)
                        console.log(`Error #${errors} Getting Feed: ${error.message}`);
                    if (errors <= maxErrors && curIndex.val < maxLength) {
                        client.busy = true;
                        scroll();
                    } else
                        err(error);
                });
            } else {
                console.log(`Got ${++nextIndex} Accounts`);
                res(arrContainingIds);
            }
        }

        //delegate every client to begin looping with onAvailableClient
        for (var i = 0; i < clients.length; i++) {
            var client = clients[i];
            if (client.busy) {
                console.log(`Client ${client.clientId} Is Busy`);
                client.queue.push(onAvailableClient);
            }
            else
                onAvailableClient(client);
        }
    });
}

module.exports = api;