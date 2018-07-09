let mongoose = require('mongoose')
	, Schema = mongoose.Schema;

// notable engagements
// notable follows
let eventSchema = new Schema({
	platform: String,
	type: String,

})

module.exports = mongoose.model('Event', eventSchema);