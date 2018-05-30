let mongoose = require('mongoose')
	, Schema = mongoose.Schema;

let profileSchema = new Schema({
	createdAt: Number,
	scID: Number,
	scAvatarUrl: String,
	scPermalink: String,
	scHandle: String,
	scTrackCount: Number,
	scCountry: String,
	scUsername: String, // full_name
	scName: String, // full_name
	scCity: String,
	scFollowers: Number,
	scFollowing: Array,
	scDescription: String,
	scPlan: String,
	genres: Array, // check all of the soundcloud tracks and regexp match for defined genres, hip-hop/hip hop/rap/r&b rnb, pop trap, etc etc
	igHandle: String,
	igAvatarUrl: String,
	igFollowers: Number,
	lastUpdated: Number
})

profileSchema.pre('save', function save(next) {
	let currentTime = Date.now();
	this.lastUpdated = currentTime;

	if(!this.createdAt)
		this.createdAt = currentTime;

  	next();
});

module.exports = mongoose.model('Profile', profileSchema);