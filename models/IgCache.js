let mongoose = require('mongoose')
	, Schema = mongoose.Schema
	, ObjectID = Schema.Types.ObjectId;

let instagramCacheSchema = new Schema({
	_id: Number, // instagram id
	username: String,
	displayName: String,
	verified: Boolean,
	avatarUrl: String,
	followers: Number
});

instagramCacheSchema.pre('save', function save(next) {
	const instagram = this;
	if(!instagram.isModified('createdAt')) instagram.createdAt = Date.now();
	next();
});

module.exports = mongoose.model('InstagramCache', instagramCacheSchema);