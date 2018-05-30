'use strict';

let fs              = require('fs')
    , Client        = require('instagram-private-api').V1
    , device        = new Client.Device('chrome')
    , storage       = new Client.CookieFileStorage('./cookies/cookie.json')
    , session;


if(!fs.existsSync('cookies'))
    fs.mkdirSync('cookies');

function clearCookies() {
    fs.writeFileSync('./cookies/cookie.json', '');
}

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
function scrapeProfile(handle) {

    return new Promise ((res, err) => {
        if (!session) err('Client not initialized');

        let info = { handle: handle, followers: [] };

        
        Client.Account.searchForUser(session, handle).then(user => {

            let feed = new Client.Feed.AccountFollowers(session, user.id);
    
            Promise.all([
                
                Client.Account.getById(session, user.id).then(data => {
                    data = data.params;
            
                    info.numFollowers = data.followerCount;
                    info.bio = data.biography;
                    info.verified = data.isVerified;
                    info.isBusiness = data.isBusiness;
                    data.externalUrl = data.externalUrl;
                    info.profilePic = data.profilePicUrl;
                    info.numFollowing = data.followingCount;
                    info.igId = user.id;
                    info.name = data.fullName;
                    info.email = data.publicEmail;
                    info.publicPhone = data.publicPhoneNumber;
                    info.contactPhone = data.contactPhoneNumber;
        
                }, err),

                new Promise((doneScrolling) => {

                    function scroll() {

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
                                scroll();
                            else
                                doneScrolling();

    
                        }, err);
                    }

                    scroll();
                })

            ]).then(() => res(info), err);
    
        }, err);

    });
}


initClient('fafsfs', 'fsaff').then(() => scrapeProfile('coltranetunes')).then(console.log, console.log);
