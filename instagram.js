'use strict';

let fs = require('fs');

if (!fs.existsSync('cookies'))
    fs.mkdirSync('cookies');

let Client    = require('instagram-private-api').V1
    , device  = new Client.Device('chrome')
    , storage = new Client.CookieFileStorage('./cookies/cookie.json')
    , clearCookies = () => fs.writeFileSync('./cookies/cookie.json', '')
    , session;

//returns a promise which is resolved upon init
function initClient(username, password) {

    return new Promise ((res, err) => {
        Client.Session.create(device, storage, username, password).then(sesh => {
            console.log('Session initialized');
            session = sesh;
            res();
        }, err);
    });
}


//returns a promise resolved with the profile info
function scrapeProfile(handle, followerCap) {

    return new Promise ((res, err) => {
        if (!session) err('Client not initialized');

        Client.Account.searchForUser(session, handle).then(user => {
            console.log(handle + '\'s User ID: ' + user.id);

            let feed = new Client.Feed.AccountFollowers(session, user.id);
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

            Promise.all([feed.all({ delay: 100, every: 200, pause: 30000, maxErrors: 9, limit: 30000 }),
                Client.Account.getById(session, user.id).then(data => {
                    data = data.params;
                    console.log(handle + ' Has ' + data.followerCount + ' Followers');
                    
                    return {
                        handle,
                        followerNum: data.followerCount,
                        bio: data.biography,
                        verified: data.isVerified,
                        isBusiness: data.isBusiness,
                        externalUrl: data.externalUrl,
                        profilePic: data.profilePicUrl,
                        followingNum: data.followingCount,
                        igId: user.id,
                        name: data.fullName,
                        email: data.publicEmail,
                        publicPhone: data.publicPhoneNumber,
                        contactPhone: data.contactPhoneNumber
                    };
                    //also doesn't scroll if no cap is provided
                    // if (info.followerNum <= followerCap)
                    //     scroll(resolve, err, feed, info);
                    // else {
                    //     info.followers = '>' + followerCap;
                    //     resolve();
                    // }
    
                }, err)
            ]).then(arr => {
                arr[1].followers = arr[0];
                res(arr[1]);
            }, err);
    
        }, err);

    });
}

//recursively load followers into info, resolving promise upon completion
// function scroll(resolve, err, feed, info) {

//     console.log('Have Loaded: ' + info.followers.length);

//     feed.get().then(followers => {

//         for (var i = 0; i < followers.length; i++) {
//             let cur = followers[i]._params;
//             info.followers.push({
//                 handle: cur.username,
//                 igId: cur.id,
//                 name: cur.fullName,
//                 private: cur.isPrivate,
//                 verified: cur.isVerified,
//             });
//         }

//         if (feed.moreAvailable)
//             scroll(resolve, err, feed, info);
//         else {

//             if (info.followers.length !== info.followerNum)
//                 console.log('Loaded ' + info.followers.length + ' of ' + info.followerNum + ' followers');

//             resolve(info);
//         }

//     }, err);
// }
        
initClient('benorgera', '****').then(() => scrapeProfile('benorgera', 30000), console.log).then((info) => {
    console.log(info);
}, console.log);
