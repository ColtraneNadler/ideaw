'use strict';

const Profile = require('./models/Profile')
	, Instagram = require('./models/Instagram')
	, InstagramSnapshot = require('./models/InstagramSnapshot');

let fs = require('fs');

if (!fs.existsSync('cookies'))
    fs.mkdirSync('cookies');

const ig = {

}

let Client    = require('instagram-private-api').V1
    , clearCookies = client => fs.writeFileSync('./cookies/' + 'kaylaleehanson' + '_cookies.json', '')
    , client = {}
    , api = {}
    , device = new Client.Device('chrome')
    , storage = new Client.CookieFileStorage('./cookies/' + 'kaylaleehanson' + '_cookies.json');

ig.populate = function(user) {
	Instagram.findOne({_id: user.id}, (err, instagram) => {
		if(err) return console.log(err);

		if(!instagram)
			instagram = new Instagram();

		instagram._id = user.id;
		instagram.username = user._params.username;
		instagram.displayName = user._params.fullName;
		instagram.avatarUrl = user._params.profilePicUrl;
		instagram.verified = user._params.isVerified;
		instagram.lastUpdate = Date.now();

		instagram.save(err => { if(err) console.log(err )});

		Profile.findOne({$or: [{instagram: instagram._id}, {aliases: {$in: [instagram.username, instagram.displayName]}}]})
		.exec((err, profile) => {
			if(err) return console.log(err);
			
			let aliases = [instagram.username];

			if(instagram.username !== instagram.displayName)
				aliases.push(instagram.displayName);

			if(!profile)
				profile = new Profile({
					displayName: instagram.displayName,
					avatarUrl: instagram.avatarUrl,
					aliases: [aliases]
				});

			for(let j = 0; j < aliases.length; j++)
					if(!(profile.aliases.indexOf(aliases[j]) > -1)) profile.aliases.push(aliases[j]);

			profile.instagram = instagram._id;
			profile.lastUpdate = Date.now();

			profile.save(err => { 
				if(err) console.log(err)
					
				let newSnapshot = new InstagramSnapshot();

				newSnapshot.instagram = instagram._id;
				newSnapshot.profile = profile._id;
				newSnapshot.followers = user._params.followerCount;

				newSnapshot.save(err => { if(err) console.log(err) });
			});
		})
	})
}

ig.getProfile = function(handle) {
	Client.Account.searchForUser(client.session, handle)
	.then(user => ig.populate(user))
	.catch(err => console.log(`Error with saving ${handle}`))
}

ig.updateProfile = function(id) {
	Client.Account.getById(client.session, id)
	.then(user => ig.populate(user))
	.catch(err => console.log(`Error with saving ${id}`))
}

Client.Session.create(device, storage, 'kaylaleehanson', 'haiku123')
.then(session => {
	client.session = session;
})

module.exports = ig;