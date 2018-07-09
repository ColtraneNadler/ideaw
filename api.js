// 7141769

const sc 		= require('./soundcloud')
	, ig 		= require('./instagram')
	, Profile 	= require('./models/Profile')
	, SoundCloud = require('./models/SoundCloud')
	, SoundCloudSnapshot = require('./models/SoundCloudSnapshot');

let mongoose 	= require('mongoose');

mongoose.connect('mongodb://cole:test123@ds129560.mlab.com:29560/clouthack', err => {
	if(err)
		return console.log(err);

	console.log('Connected to Mongo');
})

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

let scrape = (soundcloudID, link) => {
	if(link) {
		sc.getLink(link, followers => {
			followers.collection.forEach(f => profile(f));

			if(followers.next_href)
				scrape(null, followers.next_href);
			else
				console.log('Done scraping.');

		})
		return;
	}

	sc.getUser(soundcloudID, user => {
		profile(user);

		sc.getFollowers(soundcloudID, followers => {
			followers.collection.forEach(f => profile(f));

			if(followers.next_href)
				scrape(null, followers.next_href);
			else
				console.log('Done scraping.');
		})
	})
}

let profile = scProfile => {
	// update / check soundcloud
	SoundCloud.findOne({_id: scProfile.id}, (err, soundcloud) => {
		if(err) return console.log(err);

		if(!soundcloud)
			soundcloud = new SoundCloud();

		sc.getTracks(scProfile.id, tracks => {
			let totalStreams = 0
				, force = false
				, genres = [];

			if(!(scProfile.track_count > 0 && tracks.length === 0)) {
				for(let j = 0; j < tracks.length; j++) {
					totalStreams += tracks[j].playback_count;

					// if at least one of the tracks has over 1k streams force profile
					if(tracks[j].playback_count > 5000)
						force = true;

					if(!tracks[j].genre)
						continue;

					// check genres
					for(prop in genresTable)
						if(genresTable[prop].test(tracks[j].genre.toLowerCase()) && !(genres.indexOf(prop) > -1))
							genres.push(prop);

				}

				if(!force && totalStreams / tracks.length < 1000)
					return;
			}

			soundcloud._id = scProfile.id;
			soundcloud.avatarUrl = scProfile.avatur_url;
			soundcloud.permalink = scProfile.permalink;
			soundcloud.username = scProfile.username;
			soundcloud.trackCount = scProfile.track_count;
			soundcloud.country = scProfile.country;
			soundcloud.name = scProfile.full_name; // full_name
			soundcloud.city = scProfile.city;
			soundcloud.description = scProfile.description;
			soundcloud.genres = genres;

			soundcloud.save(err => { if(err) console.log(err) });

			let newSnapshot = new SoundCloudSnapshot();
			
			newSnapshot.followers = scProfile.followers_count;
			newSnapshot.following = scProfile.following_count;
			newSnapshot.trackCount = scProfile.track_count;
			newSnapshot.totalStreams = totalStreams;

			newSnapshot.save(err => { if(err) console.log(err) });
	})

	// async do profile check
	Profile.findOne({soundcloud: scProfile.id}, (err, profile) => {

	})
}

let profile = scProfile => {
	// get all the info about a user
	Profile.findOne({scID: scProfile.id}, (err, profile) => {
		if(err)
			return console.log(err);

		// has already been updated within the last 7 days
		if(profile && profile.lastUpdated > (Date.now() - (1000 * 60 * 60 * 24 * 7)))
			return;

		if(scProfile.track_count === 0 || (scProfile.followers_count < 200 && scProfile.track_count < 2))
			return;

		sc.getTracks(scProfile.id, tracks => {
			let totalStreams = 0
				, force = false
				, genres = [];

			if(!(scProfile.track_count > 0 && tracks.length === 0)) {
				for(let j = 0; j < tracks.length; j++) {
					totalStreams += tracks[j].playback_count;

					// if at least one of the tracks has over 1k streams force profile
					if(tracks[j].playback_count > 5000)
						force = true;

					if(!tracks[j].genre)
						continue;

					// check genres
					for(prop in genresTable)
						if(genresTable[prop].test(tracks[j].genre.toLowerCase()) && !(genres.indexOf(prop) > -1))
							genres.push(prop);

				}

				if(!force && totalStreams / tracks.length < 1000)
					return;
			}

			if(!profile)
				profile = new Profile({});



			sc.getFollowings(scProfile.id, profiles => {
				profile.scID = scProfile.id;
				profile.scAvatarUrl = scProfile.avatur_url;
				profile.scPermalink = scProfile.permalink;
				profile.scUsername = scProfile.username;
				profile.scTrackCount = scProfile.track_count;
				profile.scCountry = scProfile.country;
				profile.scName = scProfile.full_name; // full_name
				profile.scCity = scProfile.city;
				profile.scFollowers = scProfile.followers_count;
				profile.scFollowing = profiles;
				profile.scDescription = scProfile.description;
				profile.genres = genres;

				// go get that instagram shit
				sc.getSocials(scProfile.id, socials => {
					let igHandle;

					for(let j = 0; j < socials.length; j++)
						if(socials[j].service === 'instagram')
							igHandle = socials[j].username;

					// if no instagram 
					if(!igHandle) {
						profile.save(err => {
							if(err)
								return console.log(err);

							// save profile
						})
						return;
					}

					// if instagram
					ig.getProfile(igHandle, igProfile => {
						if(igProfile) {
							profile.igHandle = igHandle;
							profile.igAvatarUrl = igProfile.avaturUrl;
							profile.igFollowers = igProfile.followers;
						}

						profile.save(err => {
							if(err)
								return console.log(err);

							// saved profile
						})
					})
					
				})
			})
		})
	})
}

/*
* Function search
* @param min - minimum number of followers
* @param max - maximum number of followers
* @param genres - track genres artist has posted
* @param cb - callback function
*/
let search = (min, max, genres, cb) => {
	Profile.find({
		$and: [
			{
				scFollowers: { $lt: max }
			},
			{
				scFollowers: { $gt: min }
			},
			{
				genres: { $in: genres }
			}
		]
	})
	.limit(50)
	.skip(1)
	.exec(err, profiles => {
		if(err)
			return console.log(err);

		cb(profiles);
	})
}

module.exports.scrape = scrape;
module.exports.profile = profile;
module.exports.search = search;