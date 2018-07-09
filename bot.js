// 7141769

const sc 					= require('./soundcloud')
	, ig 					= require('./insta')
	, Profile 				= require('./models/Profile')
	, Instagram 			= require('./models/Instagram')
	, InstagramSnapshot 	= require('./models/InstagramSnapshot')
	, SoundCloud 			= require('./models/SoundCloud')
	, SoundCloudSnapshot 	= require('./models/SoundCloudSnapshot')
	, mongoose 				= require('mongoose');

mongoose.connect('mongodb://cole:test123@ds129560.mlab.com:29560/clouthack', err => {
	if(err)
		return console.log(err);

	console.log('Connected to Mongo');
})

// sc.scrape(62007720);
// sc.scrape(7141769);

let profile = profile => {
	let promises 	= [];

	promises.push(profile.instagram ? InstagramSnapshot.find({instagram: profile.instagram._id}).exec() : []);
	promises.push(profile.soundcloud ? SoundCloudSnapshot.find({soundcloud: profile.soundcloud._id}).exec() : []);

	Promise.all(promises)
	.then(values => {
		let igSPs 		= values[0]
			, scSPs 	= values[1]
			, avatars 	= [];

		profile.fans 	= 0;
		profile.newFans = 0;

		if(profile.instagram && profile.instagram.avatarUrl)
			avatars.push(profile.instagram.avatarUrl);
		if(profile.soundcloud && profile.soundcloud.avatarUrl)
			avatars.push(profile.soundcloud.avatarUrl);

		// ig
		if(igSPs.length !== 0) {
			let length = igSPs.length;
			if(igSPs.length > 1) {
				// do new fan conversions
				profile.newFans += igSPs[length-1].followers - igSPs[length-2].followers;
			}

			profile.fans += igSPs[length-1].followers;
		}

		// soundcloud
		if(scSPs.length !== 0) {
			let length = scSPs.length;
			if(scSPs.length > 1) {
				// do new fan conversions
				profile.newFans += scSPs[length-1].followers - scSPs[length-2].followers;
				
				let newStreams = scSPs[length-2].totalStreams - scSPs[length-1].totalStreams;

				if(!isNaN(newStreams))
					profile.newStreams = newStreams;
			}

			profile.fans += scSPs[length-1].followers;
		}
		
		// profile.avatarUrl = avatars[Math.round(Math.random() * (avatars.length -1))];
		profile.avatarUrl = profile.soundcloud.avatarUrl;
		// if(profile.instagram)
		// 	profile.avatarUrl = profile.instagram.avatarUrl;
		profile.save(err => { if(err) console.log(err) })
	})
	.catch(err => console.log(err));
}

let updateProfiles = () => {
	Profile.find({})
	.populate('instagram')
	.populate('soundcloud')
	.exec()
	.then(profiles => profiles.forEach(profile))
	.catch(err => console.log(err));
}

let updateSocials = () => {
	Profile.find({})
	.exec()
	.then(profiles => {
		profiles.forEach(profile => {
			if(profile.soundcloud)
				sc.updateProfile(profile.soundcloud);
			// if(profile.instagram)
			// 	ig.updateProfile(profile.instagram);
		})
	})
}

updateProfiles();
updateSocials();

setInterval(updateProfiles, 1000 * 30);
setInterval(updateSocials, 1000 * 60 * 120);