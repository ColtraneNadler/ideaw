'use strict';

let fs = require('fs');

if(!fs.existsSync('cookies'))
    fs.mkdirSync('cookies');

let Client    = require('instagram-private-api').V1
    , device  = new Client.Device('chrome')
    , storage = new Client.CookieFileStorage('./cookies/cookie.json')
    , clearCookies = () => fs.writeFileSync('./cookies/cookie.json', '')
    , session;

//returns a promise which is resolved upon init
function initClient(username, password) {

    return new Promise ((res, err) => {
        Client.Session.create(device, storage, username, password)
            .then(sesh => {
                session = sesh;
                res();
            })
            .catch(err);
    });
}


//returns a promise resolved with the profile info
function scrapeProfile(handle, followerCap) {

    return new Promise ((resolve, err) => {
        if (!session) err('Client not initialized');

        let info = { handle: handle, followers: [] };
        
        Client.Account.searchForUser(session, handle).then(user => {

            let feed = new Client.Feed.AccountFollowers(session, user.id);

            Client.Account.getById(session, user.id).then(data => {
                data = data.params;
            
                info.followerNum = data.followerCount;
                info.bio = data.biography;
                info.verified = data.isVerified;
                info.isBusiness = data.isBusiness;
                info.externalUrl = data.externalUrl;
                info.profilePic = data.profilePicUrl;
                info.followingNum = data.followingCount;
                info.igId = user.id;
                info.name = data.fullName;
                info.email = data.publicEmail;
                info.publicPhone = data.publicPhoneNumber;
                info.contactPhone = data.contactPhoneNumber;

                //also doesn't scroll if no cap is provided
                if (info.followerNum <= followerCap)
                    scroll(resolve, err, feed, info);
                else {
                    info.followers = '>' + followerCap;
                    resolve(info);
                }

            }, err);
    
        }, err);

    });
}

//recursively load followers into info, resolving promise upon completion
function scroll(resolve, err, feed, info) {

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
                console.log('You\'re blocked my guy');

            resolve(info);
        }


    }, err);
}
        

initClient('bafdf', 'adfadf').then(() => scrapeProfile('asdfd', 30000)).then(console.log, console.log);
