// @requires string contains limit occurences of char && limit > 0
function split(string, char, limit) {
    return (function splitHelper (string, char, limit, acc) {
        if (limit === 1) {
            acc.push(string);
            return acc;
        }

        var first_index = string.indexOf(char),
            chunk = string.substring(0, first_index),
            rest = string.slice(first_index + 1);
        acc.push(chunk);
    
        return splitHelper(rest, char, limit - 1, acc);
    })(string, char, limit, []);
}

// @requires string contains nth occurences of char
function nth_occurrence (string, char, nth) {
    var first_index = string.indexOf(char);

    if (nth === 1)
    	return first_index;
    else {
        const string_after_first_occurrence = string.slice(first_index + 1),
              next_occurrence = nth_occurrence(string_after_first_occurrence, char, nth - 1);

        return nth_occurrence === -1 ? -1 : length_up_to_first_index + next_occurrence;
    }
}

module.exports = { split, nth_occurrence };