let ig = require('./instagram'),
    config = require('./config');

Promise.all(config.igAccounts.map(acc => ig.addClient(acc.username, acc.password, 'chrome'))).then(() => {
	// return ig.getProfileByHandle('lildustyg').then(profile => {
	// 	console.log(profile);
	// 	return ig.mapIdsToAccounts(profile.followers, elem => elem._id);
	// });
	return scrapeHandle('lildustyg', {
		notableFollowers: []
	});
}, console.log).then(console.log, console.log);

function reduceIgHistory(history1, history2) {
	var recenter = history1.createdAt > history2.createdAt ? history1 : history2;

	return {
	    createdAt: recenter.createdAt,
	    followers: recenter.followers,
	    following: recenter.following,
	    averageComments: recenter.averageComments,
	    averageLikes: recenter.averageLikes,
	    notableEngagements: history1.notableEngagements.concat(history2.notableEngagements),
	    //these followers might go away
	    notableFollowers: history1.notableFollowers.concat(history2.notableFollowers)
	};
}

function scrapeHandle(handle, lastTick) {
	var res = {},
	    profile,
	    newNotableFollowers = [];

	return ig.getProfileByHandle(handle, 500).then(prof => {
		profile = prof;
		return ig.mapIdsToAccounts(profile.followers, elem => elem.igId);
	}).then((followers) => {
		for (var i = 0; i < followers.length; i++) {
			var cur = followers[i];
			if (cur.isVerified || cur.followerNum >= 10000)
				newNotableFollowers.push(cur);
		}
		newNotableFollowers.filter(follower => {
			for (var j = 0; j < lastTick.notableFollowers.length; j++)
				if (lastTick.notableFollowers[i]._id === cur._id)
					return false;
			return true;
		});

		return {
			createdAt: Date.now(),
			followers: profile.followerNum,
			following: profile.followingNum,
			averageLikes: -1,
			averageComments: -1,
			notableEngagements: [],
			notableFollowers: newNotableFollowers
		};
	});
}