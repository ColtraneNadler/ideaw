let request = require(`request`)
	clientID = `CerpMbzmgO8cpk9e9Cj43m6XCZ8HAVcl`;

let scLink = function(route) {
	let link = `http://api.soundcloud.com` + route + `?client_id=` + clientID;

	return link;
}

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

			cb(JSON.parse(body));
		})
	},

	getUser: function(id, cb) {
		request.get(scLink(`/users/${id}`), function(err, res, body) {
			if(err)
				return console.log(err);

			cb(JSON.parse(body));
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
				let tracks = JSON.parse(body);
				cb(tracks);
			} catch(e) {
				console.log('Error with track query');
				console.log(body);
				cb([]);
			}
		})
	},

	getSocials: function(id, cb) {
		request.get(scLink(`/users/${id}/web-profiles`), function(err, res, body) {
			if(err)
				return console.log(err);

			cb(JSON.parse(body));
		})
	}
}




module.exports = sc;