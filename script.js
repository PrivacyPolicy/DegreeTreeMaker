const DEBUG = false;
const HIDE_SINGLES = false;

$(function() {
    
    // TODO provide way of changing this at the beginning
    var major = "Computer Science & Information Technology, B.S.";
    var conc = "Information Assurance & Cyber Security";
    var jsonData = {};
    var rows = [[]];
    
    $.ajax({
        url: "output.json",
        dataType: "json",
        data: null,
        success: function(data, textStatus, jqXHR) {
            console.log("Loaded JSON just fine: %o", data);
            jsonData = data;
            
            // fill select box with data
            for (var m in jsonData) {
                for (var c in jsonData[m]) {
                    $("#degreeConcentration").append(
                        "<option value=\"" + m + "-" + c + "\""
                        + ">" + m + " - " + c + "</option>");
                }
            }
            $("#degreeConcentration").change(selectDegree);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.error("Failed to load JSON: " + errorThrown);
        }
    });
    
    function selectDegree(event) {
        var option = event.target.selectedOptions[0];
        if (option.value !== "null") {
            var a = option.value.split("-");
            major = a[0];
            conc = a[1];
            $("#degreeConcentration").addClass("hidden");
            init();
        }
    }
    
    function init() {
        // initialize the data
        var courses = jsonData[major][conc];
        
        if (HIDE_SINGLES) {
            var prereqIDs = [];
            for (var i = 0; i < courses.length; i++) {
                var p = courses[i].prereqs;
                for (var j = 0; j < p.length; j++) {
                    if (prereqIDs.indexOf(p[j]) === -1) {
                        prereqIDs.push(p[j]);
                    }
                }
            }
            for (var i = courses.length - 1; i >= 0; i--) {
                var c = courses[i];
                if (c.coreq.length === 0 && c.prereqs.length === 0
                    && prereqIDs.indexOf(c.id) === -1) {
                    courses.splice(i, 1);
                }
            }
        }
        
        // calculate the tree
        var tree = calculateCourseTree(courses);
        
        // display course blocks
        for (var i = tree.length - 1; i >= 0; i--) {
//        for (var i = 0; i < tree.length; i++) {
            var $row = $(document.createElement("div"));
            $row.addClass("row");
            for (var j = 0; j < tree[i].length; j++) {
                var course = tree[i][j];
                // find prerequsities
                var prereqs = "Prerequisites:\n";
                for (var k = 0; k < course.prereqs.length; k++) {
                    var id = course.prereqs[k];
                    if (typeof id === "number") {
                        var c = findCourseByID(rows, course.prereqs[k]);
                        if (c == null) continue;
                        prereqs += c.name
                            + ((k !== course.prereqs.length - 1) ? " AND\n" : "");
                    } else if (typeof id === "object") {
                        var list = id;
                        prereqs += "(";
                        var subprereqs = [];
                        for (var l = 0; l < list.length; l++) {
                            var c = findCourseByID(rows, list[l]);
                            if (c !== null) subprereqs.push(c);
                        }
                        for (var l = 0; l < subprereqs.length; l++) {
                            prereqs += subprereqs[l].name
                                + ((l !== subprereqs.length - 1) ? " OR\n" : ")\n");
                        }
                    }
                }
                if (k === 0) prereqs += "None";
                // find courses which have this course as prerequisite
                var dependStr = "Dependants:\n";
                var dependants = getDependants(rows, course);
                for (var k = 0; k < dependants.length; k++) {
                    dependStr += dependants[k].name
                        + ((k !== dependants.length - 1) ? " AND\n" : "");
                }
                var tooltip = prereqs + "\n\n" + dependStr;
                $row.append("<div class=course id="
                            + course.id + " title=\""
                            + tooltip + "\" tabindex=0>"
                            + course.name
                            + "</div>");
            }
            $(document.body).append($row);
        }
        
            
        // display lines from courses to their prereqs
        for (var i = 0; i < tree.length; i++) {
            for (var j = 0; j < tree[i].length; j++) {
                var $from = $("#" + tree[i][j].id);
                var fromX = $from.offset().left
                    + $from.width() / 2
                    + parseInt($from.css("padding-left"));
                var fromY = $from.offset().top
//                    + $from.height()
//                    + parseInt($from.css("padding-top")) * 2;
                eachPrereqInCourse(tree, tree[i][j], function(prereq, or) {
                    var $to = $("#" + prereq.id);
                    var toX = $to.offset().left
                        + $to.width() / 2
                        + parseInt($to.css("padding-left"));
                    var toY = $to.offset().top
                        + $to.height()
                        + parseInt($to.css("padding-top")) * 2;
                    // draw the line
                    var $line = $(document.createElement("div"));
                    $line.addClass("line");
                    var dY = toY - fromY, dX = toX - fromX;
                    var width = Math.sqrt(dX * dX + dY * dY);
                    var angle = Math.atan2(dY, dX);
                    $line.css({
                        left: fromX + "px",
                        top: fromY + "px",
                        transform: "rotate(" + angle + "rad)",
                        "-moz-transform": "rotate(" + angle + "rad)",
                        width: width + "px",
                        border: (or) ? "2px dashed" : "2px solid"
                    });
                    $line.attr("data-from", $from.attr("id"));
                    $line.attr("data-to", $to.attr("id"));
                    if (DEBUG) {
                        $(document.createElement("div")).css({
                            left: toX + "px",
                            top: toY + "px",
                            width: "5px",
                            height: "5px",
                            background: "red"
                        }).addClass("line").appendTo("body");
                        $(document.createElement("div")).css({
                            left: fromX + "px",
                            top: fromY + "px",
                            width: "5px",
                            height: "5px",
                            background: "red"
                        }).addClass("line").appendTo("body");
                    }
                    $line.appendTo("body");
                });
            }
        }
        
        setListeners();
    }
    
    // calculate the tree of courses (i.e. which courses go to which row)
    function calculateCourseTree(courses) {
        // preprocess data by placing all courses at the top
        for (var i = 0; i < courses.length; i++) {
            courses[i].row = 0;
            rows[0].push(courses[i]);
        }
        
        // recursively move the course's prereqs (and sub-prereqs)
        // one row below current row
        var lastRows;
        do {
            lastRows = JSON.stringify(rows);
            var i = 0;
            do {
                eachPrereqInRow(rows, i, function(course) {
                    if (course.row < i + 1) {
                        moveCourseToRow(rows, course, i + 1, true);
                    }
                });
                i++;
            } while (rows[i] && rows[i].length > 0);
        } while (lastRows != JSON.stringify(rows)); // until no change has occured
        // find all co-requisites and add them back where they belong
        // for all that have a co-requisite
        for (var i = 0; i < rows.length; i++) {
            for (var j = 0; j < rows[i].length; j++) {
                var course = rows[i][j];
                if (course.coreq.length > 0) {
                    var coreqs = [course];
                    for (var k = 0; k < course.coreq.length; k++) {
                        coreqs.push(findCourseByID(
                            rows, course.coreq[k]));
                    }
                    // move all coreqs to the lowest row
                    var maxRow = 0;
                    for (var k = 0; k < coreqs.length; k++) {
                        maxRow = Math.max(coreqs[k].row, maxRow);
                    }
                    for (var k = 0; k < coreqs.length; k++) {
                        moveCourseToRow(rows, coreqs[k], maxRow, false);
                    }
                }
            }
        }
        
        // organize all of the rows
        // most important classes to the left
        for (var i = 0; i < rows.length; i++) {
            rows[i].sort(sortCourses);
        }
        
        function sortCourses(a, b) {
            var _a = a.prereqs.length + getDependantsCount(rows, a);
            var _b = b.prereqs.length + getDependantsCount(rows, b);
            if (_a > _b) return -1;
            if (_a < _b) return 1;
            return 0;
        }
        
        return rows;
    }
    
    // function to count how many courses have course as a prereq
    function getDependantsCount(rows, course) {
        var count = 0;
        for (var i = 0; i < rows.length; i++) {
            for (var j = 0; j < rows[i].length; j++) {
                if (rows[i][j].prereqs.indexOf(course.id) 
                    !== -1) {
                    count++;
                }
            }
        }
        return count;
    }
    
    // function to get all depencies and return as a list
    function getDependants(rows, course) {
        var courses = [];
        for (var i = 0; i < rows.length; i++) {
            for (var j = 0; j < rows[i].length; j++) {
                if (arrayContains(rows[i][j].prereqs, course.id)) {
                    courses.push(rows[i][j]);
                }
            }
        }
        return courses;
    }
    
    // find if an array contains a value in itself or in subarray
    function arrayContains(array, value) {
        for (var i in array) {
            if (typeof array[i] === typeof value) {
                if (array[i] == value) {
                    return true;
                }
            } else if (typeof array[i] === "object"
                       && array[i].length !== undefined) {
                if (arrayContains(array[i], value)) {
                    return true;
                }
            }
        }
        return false;
    }
    
    // function to move course down to a specified row
    // moves the course and all prerequisites underneath it recursively
    function moveCourseToRow(rows, course, row, recursive) {
        // delete from old row
        for (var i = 0; i < rows[course.row].length; i++) {
            if (rows[course.row][i].id == course.id) {
                rows[course.row].splice(i, 1);
                break;
            }
        }
        course.row = row;
        if (rows[row] == undefined) {
            rows[row] = [];
        }
        rows[row].push(course);
        
        // move all of the course's prerequisites, too
        if (recursive) {
            eachPrereqInCourse(rows, course, function(prereq) {
                moveCourseToRow(rows, prereq, row + 1, true);
            });
        }
    }
    
    // function to find course from a list by id
    function findCourseByID(rows, id) {
        for (var i = 0; i < rows.length; i++) {
            for (var j = 0; j < rows[i].length; j++) {
                if (rows[i][j].id == id) {
                    return rows[i][j];
                }
            }
        }
        return null;
    }
    
    // find the prereqs of the courses in a given row
    function eachPrereqInRow(rows, rowInd, callback) {
        var row = rows[rowInd];
        for (var i = 0; i < row.length; i++) {
            var course = row[i];
            eachPrereqInCourse(rows, course, callback);
        }
    }
    
    // find the prereqs of a given course
    // look in rows. Else, give up.
    function eachPrereqInCourse(rows, course, callback) {
        for (var i = 0; i < course.prereqs.length; i++) {
            var prereqID = course.prereqs[i];
            if (typeof prereqID === "number") {
                var prereq = findCourseByID(rows, prereqID);
                if (prereq !== null) {
                    callback(prereq, false);
                }
            } else if (typeof prereqID === "object") {
                var list = prereqID;
                var prereqObjs = [];
                for (var j = 0; j < list.length; j++) {
                    var prereq = findCourseByID(rows, list[j]);
                    if (prereq !== null) {
                        prereqObjs.push(prereq);
                    }
                }
                for (var j = 0; j < prereqObjs.length; j++) {
                    callback(prereqObjs[j],
                             (prereqObjs.length > 1));
                }
            }
        }
    }
    

    // some fun visual stuff
    function setListeners() {
        $(".course").on("focus", function(event) {
            showHideLines(true, event);
        }).on("blur", function(event) {
            if ($(":focus").size() === 0) {
                showHideLines(false, event);
            }
        });
        
        function showHideLines(show, event) {
            if (show) {
                var id = event.currentTarget.id;
                $(".line").addClass("invisible");
                $("[data-from=" + id + "], [data-to=" + id + "]")
                    .removeClass("invisible");
            } else {
                $(".line").removeClass("invisible");
            }
        }
    }
});