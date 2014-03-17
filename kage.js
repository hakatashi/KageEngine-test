var fs = require('fs');
var paper = require('paper');
var argv = require('optimist')
	.demand([1])
	.argv;

// read argv[0] file and split them into lines
var lines = fs.readFileSync(argv._[0], {encoding: 'ascii'}).split(/\n/);

// export all KAGE data to global
KAGE = [];

var cnt = 0;

// parse all lines to KAGE structure
lines.some(function(line, index) {
	var splits = line.split('|');

	// trim formatting spaces
	var columns = [];
	splits.forEach(function(split) {columns.push(split.trim())});
	if (columns.length < 3) return false;

	var name = columns[0];

	var strokes = columns[2].split('$');

	var tmpStroke = [];
	strokes.forEach(function(stroke) {
		var params = stroke.split(':');
		var paramsInt = [];
		params.forEach(function(param, index) {
			if (params[0] == 99 && index == 7) paramsInt.push(param);
			else paramsInt.push(parseInt(param));
		});
		tmpStroke.push(paramsInt);
	});

	KAGE[name] = tmpStroke;

	cnt++;
	if (cnt % 1000 == 0) console.log('loaded ' + cnt + '. name: ' + name);
});

cnt = 0;
console.log('loading completed.');

for (name in KAGE) {
	cnt++;
	if (cnt % 1000 == 0) console.log('proceeded ' + cnt + '. name: ' + name);
	if (name.substring(0, 1) != 'u' || name.indexOf('-') !== -1 || name.indexOf('@') !== -1) continue;

	var kage = KAGE[name];

	// total glyph size is 200x200 since imaginary body is assumed to be
	// (12, 12) - (188, 188).
	var canvas = new paper.Canvas(200, 200);
	paper.setup(canvas);

	function normalizeKAGE(kage) {
		var newKage = [];
		
		kage.forEach(function(params) {
			if (params[0] == 0) return;
			if (params[0] == 99) {
				// referenced glyph name lay in 8th parameter
				var refer = params[7].split('@')[0];

				if (KAGE[refer] != undefined) {
					// invoke normalization recursively
					var refKage = normalizeKAGE(KAGE[refer]);

					var X = {start: params[3], end: params[5]};
					var Y = {start: params[4], end: params[6]};

					refKage.forEach(function(stroke) {
						var newStroke = [];
						for (var i = 0; i < 3; i++) newStroke.push(stroke[i]);
						for (var i = 3; i < stroke.length; i++) {
							// parameter representing X lay in odd index number
							if (i % 2 == 1) newStroke.push((stroke[i] * X.end + (200 - stroke[i]) * X.start) / 200);
							else newStroke.push((stroke[i] * Y.end + (200 - stroke[i]) * Y.start) / 200);
						}
						// normalized stroke is stored here
						newKage.push(newStroke);
					});
				}
			} else {
				// stroke which doesn't need normalization goes straight here
				newKage.push(params);
			}
		});

		return newKage;
	}

	strokes = normalizeKAGE(kage);

	strokes.forEach(function(stroke) {
		var path = new paper.Path({
			strokeColor: 'black',
			strokeWidth: 10
		});
		// The first parameter represents kind of stroke, and
		// second and third are shape of leading and trailing of
		// stroke. For now, we ignore shape of leading and trailing.
		switch (stroke[0]) {
			case 1: // 直線
				path.moveTo([stroke[3], stroke[4]]);
				path.lineTo([stroke[5], stroke[6]]);
				break;
			case 2: // 曲線
				path.moveTo([stroke[3], stroke[4]]);
				path.quadraticCurveTo([stroke[5], stroke[6]], [stroke[7], stroke[8]]);
				break;
			case 3: // 折れ線
				path.moveTo([stroke[3], stroke[4]]);
				path.lineTo([stroke[5], stroke[6]]);
				path.lineTo([stroke[7], stroke[8]]);
				break;
			case 4: // 乙線
				path.moveTo([stroke[3], stroke[4]]);
				path.cubicCurveTo([stroke[5], stroke[6]], [stroke[5], stroke[6]], [stroke[7], stroke[8]]);
				break;
			case 6: // 複曲線
				path.moveTo([stroke[3], stroke[4]]);
				path.cubicCurveTo([stroke[5], stroke[6]], [stroke[7], stroke[8]], [stroke[9], stroke[10]]);
				break;
			case 7: // 縦払い
				path.moveTo([stroke[3], stroke[4]]);
				path.lineTo([stroke[5], stroke[6]]);
				path.quadraticCurveTo([stroke[7], stroke[8]], [stroke[9], stroke[10]]);
				break;
		}
		// Add 'Hane' for Gothic design.
		// The second parameter represents trailing shape of stroke.
		if (stroke[2] == 4) path.cubicCurveBy([0, 5], [-20, 5], [-30, 0]); //左ハネ
		if (stroke[2] == 5) path.quadraticCurveBy([5, 0], [5, -30]); //上ハネ
	});

	// check if two path share their first or last segment
	function needsJoin(pathA, pathB) {
		var firstA = pathA.firstSegment.point;
		var lastA = pathA.lastSegment.point;
		var firstB = pathB.firstSegment.point;
		var lastB = pathB.lastSegment.point;

		if (firstA.equals(firstB)
				|| firstA.equals(lastB)
				|| lastA.equals(firstB)
				|| lastA.equals(lastB)) return true;
		else return false;
	}

	// join neighboring strokes
	paper.project.activeLayer.children.forEach(function(child1, index1) {
		paper.project.activeLayer.children.forEach(function(child2, index2) {
			if (child1 !== child2 && needsJoin(child1, child2)) {
				child1.join(child2);
			}
		});
	});
/*
	//Update paper view.
	paper.view.update();

	var stream = canvas.pngStream();
	var output = fs.createWriteStream(__dirname + '/png/' + name + '.png');
	
	stream.pipe(output);
*/
	var svg = paper.project.exportSVG({asString: true});
	var output = __dirname + '/svg/' + name + '.svg';
	fs.writeFileSync(output, svg);
}

