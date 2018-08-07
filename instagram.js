const Profile = new require('./models/Profile')()
    , Instagram = new require('./models/Instagram')()
    , InstagramSnapshot = require('./models/InstagramSnapshot')
    , Client = require('./igRedisDistributedClient');

function getFollowers(id) {
    return getFeed(c => Client.getFollowers(id, c)).then(arr => idsToProfiles(arr, 'id'));
}

function idsToProfiles(idArray, idAttribute) {
    return Promise.all(idArray.map(elem => Client.getProfileById(elem[idAttribute])));
}

function getFeed(nextGivenCursor) {
    var feed = [];

    return new Promise((res, err) => {
        function recurse(data) {
            const { arr, cursor } = data;
            feed.push(...arr);
            if (cursor) {
                console.log(`Have ${feed.length} of Feed`);
                nextGivenCursor(cursor).then(recurse, err);
            } else {
                console.log('Got Entire Feed');
                res(feed);
            }
        }

        nextGivenCursor().then(recurse, err);
    });
}

function getMedia(id) {
    return getFeed(c => Client.getMedia(id, c));
}

function getSnapshot(id) {
    return Promise.all([
        getFollowers(id),
        getMedia(id)
    ]).then(arr => {
        return {
            _id: id,
            media: arr[1],
            followers: arr[0],
        };
    });
}

const test = () => {
    Client.getProfileByHandle('c0ffincvnt').then(profile => {
        console.log(profile);
        getFollowers(profile._id).then(console.log);
    });
};
test();

function getCumulativeSnapshot(profile) {
    return InstagramSnapshot.find({ _id: profile._id }).exec().then(snaps => {
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

module.exports = { getSnapshot, getProfileByHandle: Client.getProfileByHandle };