// All properties needed
var step_point = 1;
var current_svg_xml = "";
var current_svg_width = 0;
var current_svg_height = 0;
var itemInsideDropzone = null;
var dropzone = null;
var msToWaitAfterOverlay = 250;

$(document).ready(function() {
    setupPointsSetting();
    setupGenerationFromText();
    setupCanvas();
    setupDropzone();

    // Directly drop the title logo to debug
    // current_svg_xml = $("#svgTitle")[0].outerHTML;
    // generatePointsFromSvg();
});

function setupCanvas() {
    paper = Raphael(document.getElementById("canvas"), '100%', '100%');
    current_displayed_paths = null;
}

function setupDropzone() {
    document.getElementById('dropzone').addEventListener('drop', manageDropFromTitle, false);
    
    $('#dropzone').dropzone({
        url: "/upload",
        maxFilesize: 5,
        maxThumbnailFilesize: 1,
        autoProcessQueue: false,
        //acceptedFiles: '.svg',
        init: function() {
            dropzone = this;

            this.on('addedfile', function(file) {
                if (file.type != "image/svg+xml") {
                    $.notify("Invalid format, only SVG is supported", "error");
                    removeItemFromDropzone();
                    return;
                }

                displayHoldOnOverlay("Generating points from SVG");

                removeItemFromDropzone();

                itemInsideDropzone = file;
                read = new FileReader();

                read.readAsBinaryString(file);

                read.onloadend = function() {
                    current_svg_xml = read.result;
                    setTimeout(generatePointsFromSvg, msToWaitAfterOverlay);
                }   
            });
        }
    });
}

function hideHoldOnOverlay() {
    HoldOn.close();
}

function displayHoldOnOverlay(msg) {
    HoldOn.open({message: msg});
    $(".note").hide();
}

function removeItemFromDropzone() {
    current_svg_xml = "";

    if (itemInsideDropzone != null) {
        dropzone.removeFile(itemInsideDropzone);
        itemInsideDropzone = null;
    }

    $(".dz-preview-manually").remove();
}

function setupGenerationFromText() {
    $('#btn-text').click(function() {
        $("#dialog-generate-from-text").dialog({
        resizable: false,
        height: "auto",
        width: 400,
        modal: true,
        buttons: {
            "Generate": function() {
                displayHoldOnOverlay("Generating points from text");
                $(this).dialog("close");

                setTimeout(function () {
                    removeItemFromDropzone();

                    var font_selected = "fonts/" + $("#fonts").find(":selected").val();
                    var url_font = $("#url_font").val();
                    var text_svg = $("#text_svg").val();
                    var font_size = parseInt($("#font_size").val());

                    if (text_svg == "" || isNaN(font_size) || font_size <= 0) {
                        $.notify("Invalid fields, do you even UI ?", "error");
                        hideHoldOnOverlay();
                        return;
                    }

                    if (url_font == "")
                        url_font = font_selected;

                    opentype.load(url_font, function(err, font) {
                        console.assert(!err, err);
                        paths = font.getPaths(text_svg, ($("#dropzone").width() / 2) - (font_size * text_svg.length / 4), font_size, font_size);
                        
                        var svgText = "<svg class='dz-preview-manually' width='100%' height='100%'>";
                        for (var i = 0; i < paths.length; ++i) {
                            svgText += paths[i].toSVG();
                        }
                        svgText += "</svg>";
                        $("#dropzone").append(svgText);

                        current_svg_xml = svgText;
                        generatePointsFromSvg();

                        hideHoldOnOverlay();
                    });
                }, msToWaitAfterOverlay);
            },
            "Cancel": function() {
                $(this).dialog("close");
            }
        }
        });
    });
}

function setupPointsSetting() {
    $("#step_point").val(step_point.toString());

    $('#btn-apply').click(function() {
        step_point = parseInt($("#step_point").val());

        if (current_svg_xml == "")
            return;

        displayHoldOnOverlay("Applying new step points length to SVG");

        if (step_point <= 0) step_point = 1;
        setTimeout(generatePointsFromSvg, 500);
    });
}

function getInfosFromPaths(paths) {
    var paths_info = [];
    var initialized = false;
    for (var i = 0; i < paths.length; ++i) {
        var path = $($(paths).get(i)).attr('d').replace(' ', ',');
        var shape = paper.path(path);
        var bbox_path = shape.getBBox();
        shape.remove();

        // Draw the shape
        // var shape = paper.path(path);
        // var bbox_path = shape.getBBox();
        // shape.remove();

        // Show shapes infos
        // paper.path(path);
        // var container = paper.rect(bbox_path.x, bbox_path.y, bbox_path.width, bbox_path.height);
        // container.attr("stroke", "red");

        if (!initialized) {
            initialized = true; 
            paths_info.bbox_top = paths_info.bbox_bottom = paths_info.bbox_left = paths_info.bbox_right = bbox_path;
            continue;
        }

        if (paths_info.bbox_top != bbox_path && (paths_info.bbox_top.y > bbox_path.y))
            paths_info.bbox_top = bbox_path;
        if (paths_info.bbox_bottom != bbox_path && (bbox_path.y + bbox_path.height > paths_info.bbox_bottom.y + paths_info.bbox_bottom.height))
            paths_info.bbox_bottom = bbox_path;
        if (paths_info.bbox_left != bbox_path && (paths_info.bbox_left.x > bbox_path.x))
            paths_info.bbox_left = bbox_path;
        if (paths_info.bbox_right != bbox_path && (bbox_path.x + bbox_path.width > paths_info.bbox_right.x + paths_info.bbox_right.width))
            paths_info.bbox_right = bbox_path;
    }

    paths_info.width = (paths_info.bbox_right.x + paths_info.bbox_right.width) - paths_info.bbox_left.x;
    paths_info.height = (paths_info.bbox_bottom.y + paths_info.bbox_bottom.height) - paths_info.bbox_top.y;
    paths_info.x = paths_info.bbox_left.x;
    paths_info.y = paths_info.bbox_top.y;
    if (paths_info.height > paths_info.width)
        paths_info.scale = (paths_info.height > paper.canvas.clientHeight) ? (paper.canvas.clientHeight / paths_info.height) : 1;
    else
        paths_info.scale = (paths_info.width > paper.canvas.clientWidth) ? (paper.canvas.clientWidth / paths_info.width) : 1;

    // console.log(paths_info);
    // Display bboxes used for centering paths
    // var bboxes = [paths_info.bbox_right, paths_info.bbox_left, paths_info.bbox_top, paths_info.bbox_bottom];
    // for (var i = 0; i < 4; ++i) {
    //     var container = paper.rect(bboxes[i].x + 300, bboxes[i].y + 300, bboxes[i].width, bboxes[i].height);
    //     container.attr("stroke", "red");
    // }

    return paths_info;
}

const nextColor = (() => {
	let count = 0
	, colors = ["gold", "brown", "blue", "green", "indigo", "coral", "orange", "orangered", "black", "aqua", "magenta"];
	return () => {
		return colors[(count++ % colors.length)];
	};
})();

function generatePointsFromSvg() {
    paper.clear();
    $('.bellows').remove();
    $('#settings').after("<div class='bellows'></div>");
    $('.bellows').show();

    var parser = new DOMParser();
    var doc = parser.parseFromString(current_svg_xml, "application/xml");
    var paths = doc.getElementsByTagName("path");
    current_displayed_paths = paths;

    // Read each paths from svg
    var paths_info = getInfosFromPaths(paths);
    var offset_path_x = (paths_info.x * paths_info.scale * -1) + (paper.canvas.clientWidth / 2) - (paths_info.width * paths_info.scale / 2);
		var offset_path_y = (paths_info.y * paths_info.scale * -1) + (paper.canvas.clientHeight / 2) - (paths_info.height * paths_info.scale / 2);
		/** @type {Object<string, Array<{x: Number, y: Number}>>} */
		const all_points_obj = {};
    var all_points = "";
    for (var i = 0; i < paths.length; ++i) {
        var path = $($(paths).get(i)).attr('d').replace(' ', ',');

				// Let's generate points for usage in R!
				const data_points_r = [];

				// get points at regular intervals
        var color = nextColor();
        var c;
        for (c = 0; c < Raphael.getTotalLength(path); c += step_point) {
            var point = Raphael.getPointAtLength(path, c);

						data_points_r.push({ x: point.x, y: point.y });
						paper.circle(point.x * paths_info.scale, point.y * paths_info.scale, 2)
                .attr("fill", color)
                .attr("stroke", "none")
                .transform("T" + offset_path_x * paths_info.scale + "," + offset_path_y * paths_info.scale);
				}


				all_points_obj[color] = data_points_r;

				const temp = {};
				temp[color] = data_points_r;
				addBelow("Path " + i, color, temp);
    }

    addBelow("All Paths", nextColor(), all_points_obj);
    
    $('.bellows').bellows();
    hideHoldOnOverlay();
}

const xyPathToR = (xyData, prefix = void 0) => `${prefix ? `${prefix}_` : ''}x <- c(${xyData.map(p => p.x).join(',')})&#13;&#13;${prefix ? `${prefix}_` : ''}y <- c(${xyData.map(p => p.y).join(',')})`;

/**
 * @param {Object<string, Array<{x: Number, y: ArrayNumber}>>} data
 */
const downloadAsCsv = (filename, data) => {
	const k = Object.keys(data)
	, numRows = data[k[0]].length
	, rows = [...Array(numRows + 1)].map(() => []);
	
	const set = new Set(k.map(key => data[key].length));
	if (set.size > 1) {
		if (!confirm('The series have different lengths, be careful with the resulting CSV! Filling with blanks.')) {
			return;
		}
	}

	// append header:
	k.forEach(key => {
		rows[0].push(`${key}_x`, `${key}_y`);
	});

	// fill rows:
	for (let i = 0; i < numRows; i++) {
		k.forEach(key => {
			if (i >= data[key].length) {
				rows[i + 1].push('', '');
			} else {
				rows[i + 1].push(data[key][i].x);
				rows[i + 1].push(data[key][i].y);
			}
		});
	}

	// Let's join it all together
	const text = rows.map(r => r.join(';')).join('\n');

	var pom = document.createElement('a');
	pom.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
	pom.setAttribute('download', `${filename}.csv`);

	if (document.createEvent) {
		var event = document.createEvent('MouseEvents');
		event.initEvent('click', true, true);
		pom.dispatchEvent(event);
	}
	else {
		pom.click();
	}
};

/**
 * @param {Object<string, Array<{x: Number, y: Number}>>} data
 */
function addBelow(name, color, data) {
	const nb_pts = Object.keys(data).map(pathName => data[pathName].length).reduce((a, b) => a + b, 0);

	const dataAsR = Object.keys(data).map(pathName => {
		return xyPathToR(data[pathName], pathName);
	}).join('&#13;&#13;');

	$('.bellows').append($('<div/>')
		.addClass('bellows__item')
		.append($('<div/>')
			.addClass('bellows__header')
			.attr('style', `background-color: ${color}`)
			.text(name)
			.append($('<span/>').text(`${nb_pts} pts`))
		).append($('<div/>')
			.addClass('bellows__content')
			.append($('<textarea/>')
				.attr('rows', 10)
				.attr('cols', 50)
				.val(dataAsR)
			).append($('<div/>')
				.append($('<button/>')
					.text('Download as CSV')
					.on('click', jqEvt => {
						downloadAsCsv(name, data);
					})
				)
			)
		)
	);
}

// Hacky function to manage "fake" drop from image title
function manageDropFromTitle(evt) {
    var svgUrl = evt.dataTransfer.getData('URL');
    
    // Load local svg file from URL
    if (svgUrl.endsWith("img/TitlePathToPoints.svg")) {
        removeItemFromDropzone();

        $("#dropzone").append("<img class='dz-preview-manually' src='img/TitlePathToPoints.svg'>");

        current_svg_xml = $("#svgTitle")[0].outerHTML;
        generatePointsFromSvg();
    }
}