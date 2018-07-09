let mongoose = require('mongoose')
	, Schema = mongoose.Schema
	, ObjectID = Schema.Types.ObjectId;

let soundcloudSchema = new Schema({
	_id: Number, // instagram id
	username: String,
	displayName: String,
	description: String,
	avatarUrl: String,
	permalink: String,
	trackCount: Number,

	city: String,
	country: String,

	followerTrend: Number,

	profile: {
		type: ObjectID,
		ref: 'Profile'
	},

	genres: Array,

	createdAt: Number,
	lastUpdated: Number
})

soundcloudSchema.pre('save', function save(next) {
	const soundcloud = this;
	if(!soundcloud.isModified('createdAt')) soundcloud.createdAt = Date.now();
	next();
});

module.exports = mongoose.model('SoundCloud', soundcloudSchema);