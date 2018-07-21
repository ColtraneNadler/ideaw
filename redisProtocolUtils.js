// @requires string contains limit occurences of sub && limit > 0
function split(string, sub, limit) {
    const len = sub.length;
    return (function splitHelper (string, sub, limit, acc) {
        if (limit === 1) {
            acc.push(string);
            return acc;
        }

        var first_index = string.indexOf(sub),
            chunk = string.substring(0, first_index),
            rest = string.slice(first_index + len);
        acc.push(chunk);
    
        return splitHelper(rest, sub, limit - 1, acc);
    })(string, sub, limit, []);
}

// @requires string contains nth occurences of sub
function nth_occurrence (string, sub, nth) {
    const first_index = string.indexOf(sub)
        , len = sub.length;

    if (nth === 1)
    	return first_index;
    else {
        const string_after_first_occurrence = string.slice(first_index + len),
              next_occurrence = nth_occurrence(string_after_first_occurrence, sub, nth - 1);

        return nth_occurrence === -1 ? -1 : length_up_to_first_index + next_occurrence;
    }
}

module.exports = { split, nth_occurrence };