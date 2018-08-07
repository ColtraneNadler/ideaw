let mongoose = require('mongoose')
	, Schema = mongoose.Schema
	, ObjectID = Schema.Types.ObjectId;

let instaWorkerSchema = new Schema({
	username: String,
	password: String,
	createdAt: Number
});

instaWorkerSchema.pre('save', function save(next) {
	const instagram = this;
	if(!instagram.isModified('createdAt')) instagram.createdAt = Date.now();
	next();
});

module.exports = mongoose.model('InstaWorker', instaWorkerSchema);