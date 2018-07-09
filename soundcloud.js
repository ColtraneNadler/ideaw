const ig = require('./insta')
	, Profile = require('./models/Profile')
	, SoundCloud = require('./models/SoundCloud')
	, SoundCloudSnapshot = require('./models/SoundCloudSnapshot');

let request = require(`request`)
	clientID = `CerpMbzmgO8cpk9e9Cj43m6XCZ8HAVcl`;

let scLink = function(route) {
	let link = `http://api.soundcloud.com` + route + `?client_id=` + clientID;

	return link;
}

let genresTable = {
	'hip-hop': (new RegExp('^(?=.*hip)(?=.*hop).*$', 'im')),
	'rap': /rap/,
	'trap': /rap/,
	'country': /country/,
	'electronic': /electronic/,
	'jersey club': (new RegExp('^(?=.*jersey)(?=.*club).*$', 'im')),
	'r&b': /(rnb)|(r&b)/,
	'indie': /indie/,
	'future bass': (new RegExp('^(?=.*future)(?=.*bass).*$', 'im')),
	'alternative': /alternative/,
	'edm': /edm/

}

let count = 0;

let sc = {
	findUser: function(q, cb) {
		request.get(`http://api.soundcloud.com/users?q=` + q + `&client_id=` + clientID, function(err, res, body) {
			if(err)
				return console.log(err);

			let find = JSON.parse(body)[0];
			cb({id: find.id, username: find.username, permalink: find.permalink, followers: find.followers_count});
		})
	},
	
	getLink: function(link, cb) {
		request.get(link, function(err, res, body) {
			if(err)
				return console.log(err);

			try {
				cb(JSON.parse(body));
			} catch(err) {
				console.log('Error' + err);
			}
		})
	},

	getUser: function(id, cb) {
		request.get(scLink(`/users/${id}`), function(err, res, body) {
			if(err)
				return console.log(err);

			try {
				cb(JSON.parse(body));
			} catch(err) {
				console.log('Error' + err);
			}
		})
	},

	getFollowers: function(id, cb) {
		request.get(scLink(`/users/${id}/followers`), function(err, res, body) {
			if(err)
				return console.log(err);

			cb(JSON.parse(body));
		})
	},

	getFollowings: function(id, cb, link) {
		let profiles = [];

		if(link) {
			sc.getLink(link, body => {
				let followings = body.collection;

				if(followers.next_href)
					getFollowings(null, cb, body.next_href);
				else
					cb(profiles)

			})
			return;
		}

		request.get(scLink(`/users/${id}/followings`), function(err, res, body) {
			if(err)
				return console.log(err);
			
			let followings = JSON.parse(body).collection;
			
			// Itterate through collection and push IDs to list
			for(let j = 0; j < followings.length; j++)
				profiles.push(followings[j].id);
			
			// if there are more followers, continue loop, otherwise break with callback
			if(body.next_href)
				getFollowings(null, cb, body.next_href);
			else
				cb(profiles);
		})
	},

	getTracks: function(id, cb) {
		request.get(scLink(`/users/${id}/tracks`), function(err, res, body) {
			if(err)
				return console.log(err);

			try {
				let tracks = typeof body === 'object' ? body : JSON.parse(body);
				cb(tracks);
			} catch(e) {
				console.log('Error with track query');
				console.log(e);
				// console.log(typeof body);
				// console.log(body);
				cb([]);
			}
		})
	},

	getSocials: function(id, cb) {
		request.get(scLink(`/users/${id}/web-profiles`), function(err, res, body) {
			if(err)
				return console.log(err);

			try {
				cb(JSON.parse(body));
			} catch(err) {
				console.log(err);
				return [];
			}
		})
	}
}

sc.populate = function(scProfile, bool) {
	if(!scProfile.id)
		return;

	if(scProfile.followers_count === 0)
		return;


	// update / check soundcloud
	SoundCloud.findOne({_id: scProfile.id}, (err, soundcloud) => {
		if(err) return console.log(err);

		if(!soundcloud)
			soundcloud = new SoundCloud();

		sc.getTracks(scProfile.id, tracks => {
			if(bool && tracks.length === 0)
				return;

			console.log(tracks.length);

			let totalStreams = 0
				, force = false
				, avgStreams = 0
				, genres = [];

			if(bool && !(scProfile.track_count > 0 && tracks.length === 0)) {
				console.log('yer')
				for(let j = 0; j < tracks.length; j++) {
					totalStreams += tracks[j].playback_count;

					// if at least one of the tracks has over 1k streams force profile
					if(tracks[j].playback_count > 10000) force = true;

					if(!tracks[j].genre) continue;

					// check genres
					for(prop in genresTable)
						if(genresTable[prop].test(tracks[j].genre.toLowerCase()) && !(genres.indexOf(prop) > -1))
							genres.push(prop);

				}
				avgStreams = Math.round(totalStreams / tracks.length);

				if(!force && avgStreams < 2000 || isNaN(avgStreams))
					return;
			}

			let avi = scProfile.avatar_url.split('large').join('t500x500');

			soundcloud._id = scProfile.id;
			soundcloud.avatarUrl = avi;
			soundcloud.permalink = scProfile.permalink;
			soundcloud.username = scProfile.username;
			soundcloud.trackCount = scProfile.track_count;
			soundcloud.country = scProfile.country;
			soundcloud.displayName = scProfile.full_name; // full_name
			soundcloud.displayNameToLowerCase = scProfile.full_name.toLowerCase;
			soundcloud.city = scProfile.city;
			soundcloud.description = scProfile.description;
			soundcloud.genres = genres;
			soundcloud.lastUpdate = Date.now();

			count++;
			if(!soundcloud._id)
				return;

			soundcloud.save(err => { if(err) console.log(err) });

			// go get that instagram shit
			sc.getSocials(scProfile.id, socials => {
				let instagram, spotify, youtube, facebook, tumblr;
				
				let aliases = [];

				for(let j = 0; j < socials.length; j++)
					switch(socials[j].service) {
						case 'instagram':
							instagram = socials[j].username;
							// scrape instagram
							if(bool) ig.getProfile(instagram);
							if(!(aliases.indexOf(instagram) > -1)) aliases.push(instagram);
							break;
						case 'youtube':
							youtube = socials[j].username;
							// scrape youtube
							if(!(aliases.indexOf(youtube) > -1)) aliases.push(youtube);
							break;
						case 'facebook':
							facebook = socials[j].username;
							if(!(aliases.indexOf(facebook) > -1)) aliases.push(facebook);
							break; 
						case 'twitter':
							twitter = socials[j].username;
							if(!(aliases.indexOf(twitter) > -1)) aliases.push(twitter);
							break;
						case 'tumblr':
							tumblr = socials[j].username;
							if(!(aliases.indexOf(tumblr) > -1)) aliases.push(tumblr);
							break; 
					}

				// Profile.findOne({$or: [{soundcloud: soundcloud._id}, {aliases: {$in: [soundcloud.username, soundcloud.displayName]}}]})
				Profile.findOne({$or: [{soundcloud: soundcloud._id}, {aliases: soundcloud.username}]})
				.exec((err, profile) => {
					if(err) return console.log(err);

					if(!(aliases.indexOf(soundcloud.permalink) > -1))
						aliases.push(soundcloud.permalink);

					if(!(aliases.indexOf(soundcloud.username) > -1))
						aliases.push(soundcloud.username);

					if(!(aliases.indexOf(soundcloud.username) > -1) && soundcloud.displayName && soundcloud.displayName !== soundcloud.username)
						aliases.push(soundcloud.displayName);

					if(!profile)
						profile = new Profile({
							name: soundcloud.displayName,
							avatarUrl: avi,
							aliases: aliases
						});

					for(let j = 0; j < aliases.length; j++)
						if(!(profile.aliases.indexOf(aliases[j]) > -1)) profile.aliases.push(aliases[j]);

					profile.genres = genres
					profile.soundcloud = soundcloud._id;
					profile.lastUpdate = Date.now();
					profile.save(err => { 
						if(err) console.log(err )

						let newSnapshot = new SoundCloudSnapshot();
						
						newSnapshot.soundcloud = soundcloud._id;
						newSnapshot.profile = profile._id;
						newSnapshot.followers = scProfile.followers_count;
						newSnapshot.following = scProfile.following_count;
						newSnapshot.trackCount = scProfile.track_count;
						newSnapshot.avgStreams = avgStreams;
						newSnapshot.totalStreams = totalStreams;
						
						newSnapshot.save(err => { if(err) console.log(err) });
					});
				})
			})
		})
	})
}

sc.updateProfile = soundcloudID => sc.getUser(soundcloudID, user => sc.populate(user));

sc.scrape = function(soundcloudID, link) {
	if(link) {
		sc.getLink(link, followers => {
			// for(let j = 0; j < followers.collection.length; j++)
			// 		sc.updateProfile(followers.collection[j], true)
			followers.collection.forEach(f => sc.populate(f, true));

			if(followers.next_href)
				sc.scrape(null, followers.next_href);
			else
				console.log('Done scraping.');

		})
		return;
	}

	sc.getUser(soundcloudID, user => {
		sc.populate(user, true);

		sc.getFollowers(soundcloudID, followers => {
			followers.collection.forEach(f => sc.populate(f, true));

			if(followers.next_href)
				sc.scrape(null, followers.next_href);
			else
				console.log('Done scraping.');
		})
	})
}





module.exports = sc;