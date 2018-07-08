'use strict';

let fs = require('fs');

if (!fs.existsSync('cookies'))
    fs.mkdirSync('cookies');

let Client    = require('instagram-private-api').V1
    , clearCookies = client => fs.writeFileSync('./cookies/' + client.username + '_cookies.json', '')
    , clients = [];

const msPerRequestsPerClient = 100; //ms which must have passed since last request was received

//returns a promise which is resolved upon init

// Proxy URL has a standard format:
// Unauthenticated: http(s)://yourhost.com/
// Authenticated: http(s)://user:pass@yourhost.com/
function addClient(username, password, deviceString, proxyURL) {

    var device = new Client.Device(deviceString),
        storage = new Client.CookieFileStorage('./cookies/' + username + '_cookies.json');

    return Client.Session.create(device, storage, username, password, proxyURL || undefined).then(session => {
        console.log('Client `' + username + '` Session Initialized');
        clients.push({
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
function getAvailableClient() {
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

function freeClient(client) {
    client.lastRequestMs = Date.now();
    setTimeout(() => {
        client.busy = false;
        if (client.queue.length > 0 && typeof client.queue[0] === 'function')
            client.queue.shift()(client);
    }, msPerRequestsPerClient);
}

//if given a session, the client passed is being used by a larger process and is not freed
//if given no session, the client gotten is freed
function getProfileById(id, session) {
    function get(sesh) {
        return Client.Account.getById(sesh, id).then(data => {
            data = data.params;
            console.log(id + ' Has ' + data.followerCount + ' Followers');
            
            return {
                handle: data.username,
                followerNum: data.followerCount,
                bio: data.biography,
                verified: data.isVerified,
                isBusiness: data.isBusiness,
                externalUrl: data.externalUrl,
                profilePic: data.profilePicUrl,
                followingNum: data.followingCount,
                igId: id,
                name: data.fullName,
                email: data.publicEmail,
                publicPhone: data.publicPhoneNumber,
                contactPhone: data.contactPhoneNumber
            };
        });
    }
    return session ? get(session) : getAvailableClient().then(client => {
        return get(client.session).then(profile => {
            freeClient(client);
            return profile;
        });
    });
}

//returns a promise resolved with the profile info
function getProfileByHandle(handle, followerCap) {

    return getAvailableClient().then(client => {
        return Client.Account.searchForUser(client.session, handle).then(user => {
            console.log(handle + '\'s User ID: ' + user.id);
    
            let feed = new Client.Feed.AccountFollowers(client.session, user.id);
            feed.map = cur => {
                return {
                    handle: cur._params.username,
                    igId: cur.id,
                    name: cur._params.fullName,
                    private: cur._params.isPrivate,
                    verified: cur._params.isVerified,
                };
            };
            //feed.reduce to only store the good ones

            return Promise.all([feed.all({ delay: msPerRequestsPerClient, every: 100, pause: 20000, maxErrors: 9, limit: followerCap || 30000}),
                getProfileById(user.id, client.session)
            ]).then(arr => {
                freeClient(client);
                arr[1].followers = arr[0];
                return arr[1];
            });
        });
    });
}

//recursively load followers into info, resolving promise upon completion
function scroll(resolve, err, feed, info) {

    console.log('Have Loaded: ' + info.followers.length);

    feed.get().then(followers => {

        for (var i = 0; i < followers.length; i++) {
            let cur = followers[i]._params;
            info.followers.push({
                handle: cur.username,
                igId: cur.id,
                name: cur.fullName,
                private: cur.isPrivate,
                verified: cur.isVerified,
            });
        }

        if (feed.moreAvailable)
            scroll(resolve, err, feed, info);
        else {

            if (info.followers.length !== info.followerNum)
                console.log('Loaded ' + info.followers.length + ' of ' + info.followerNum + ' followers');

            resolve(info);
        }

    }, err);
}

function availableClients() {
    var num = 0;
    for (var i = 0; i < clients.length; i++)
        if (!clients[i].busy)
            num++;
    return num;
}

//destructive to original array, like array map
function idsToAccounts(arrContainingIds) {
    return new Promise((res, err) => {
        var curIndex = [0],
            len = arrContainingIds.length;
    
        function onAvailableClient(client) {
            var nextIndex = curIndex[0];
            if (curIndex[0] < len) {
                curIndex[0] = nextIndex + 1;
                var id = arrContainingIds[nextIndex].igId;
                console.log('Getting Profile With Id: ' + id);
                getProfileById(id, client.session).then(profile => {
                    arrContainingIds[nextIndex] = profile;
                    client.queue.push(onAvailableClient);
                    freeClient(client);
                }).catch(err);
            } else {
                console.log(len, curIndex[0]);
                res(arrContainingIds);
            }
        }

        //delegate every client to begin looping with onAvailableClient
        for (var i = 0; i < clients.length; i++) {
            var client = clients[i];
            if (client.busy)
                client.queue.push(onAvailableClient);
            else
                onAvailableClient(client);
        }
    });
}
        
addClient('benorgera', 'Benjaminso12!', 'chrome')
    .then(() => getProfileByHandle('benorgera', 30000), console.log)
    .then(profile => { console.log(profile); return idsToAccounts(profile.followers); }, console.log)
    .then(console.log);
