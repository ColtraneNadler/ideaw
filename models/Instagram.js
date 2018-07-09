let mongoose = require('mongoose')
	, Schema = mongoose.Schema
	, ObjectID = Schema.Types.ObjectId;

let instagramSchema = new Schema({
	_id: Number, // instagram id
	username: String,
	displayName: String,
	bio: String,
	avatarUrl: String,

	followerTrend: Number,

	profile: {
		type: ObjectID,
		ref: 'Profile'
	},

	verified: Boolean,

	createdAt: Number,
	lastUpdated: Number
})

instagramSchema.pre('save', function save(next) {
	const instagram = this;
	if(!instagram.isModified('createdAt')) instagram.createdAt = Date.now();
	next();
});

module.exports = mongoose.model('Instagram', instagramSchema);