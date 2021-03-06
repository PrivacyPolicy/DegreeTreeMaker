$(function() {
    const DEBUG = false;
    var hideSingles = false;
    const MAX_TRIES = 100;
    
    var major = "Computer Science & Information Technology, B.S.";
    var conc = "Information Assurance & Cyber Security";
    var jsonData = {};
    var rows = [[]];
    
    $.ajax({
        url: "output.json",
        dataType: "json",
        data: null,
        success: function(data, textStatus, jqXHR) {
            if (DEBUG) {
                console.log("Loaded JSON just fine: %o", data);
            }
            jsonData = data;
            
            // fill select box with data
            for (var m in jsonData) {
                for (var c in jsonData[m]) {
                    $("#degreeConcentration").append(
                        "<option value=\"" + m + "-" + c + "\""
                        + ">" + m + " &nbsp;-&nbsp; " + c
                        + "</option>");
                }
            }
            $("#degreeConcentration").change(selectDegree);
            $("#showSingles").change(function(event) {
                hideSingles = !event.target.checked;
                var selElem = $("#degreeConcentration").get(0);
                if (selElem.selectedIndex !== 0) {
                    init();
                }
            });
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
            init();
        }
    }
    
    function init() {
        // initialize the data
        var courses = jsonData[major][conc].slice();
        // ensure that if course A has a coreq B, then course
        // B's coreq list includes course A
        for (var i = 0; i < courses.length; i++) {
            var course = courses[i];
            for (var j = 0; j < course.coreqs.length; j++) {
                var coreq = course.coreqs[j];
                var coreqObj = findCourseByID([courses], coreq);
                if (coreqObj.coreqs.indexOf(course.id) === -1) {
                    coreqObj.coreqs.push(course.id);
                }
                // add coreqs from A to B and vice-versa
                var coCoreqs = coreqObj.coreqs;
                var coreqs = course.coreqs;
                for (var k = 0; k < coreqs.length; k++) {
                    if (coCoreqs.indexOf(coreqs[k]) === -1) {
                        coCoreqs.push(coreqs[k]);
                    }
                }
                for (var k = 0; k < coCoreqs.length; k++) {
                    if (coreqs.indexOf(coCoreqs[k]) === -1) {
                        coreqs.push(coCoreqs[k]);
                    }
                }
            }
        }
        
        if (hideSingles) {
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
                if (c.coreqs.length === 0 && c.prereqs.length === 0
                    && prereqIDs.indexOf(c.id) === -1) {
                    courses.splice(i, 1);
                }
            }
        }
        
        // calculate the tree
        var tree = calculateCourseTree(courses);
        
        displayTree(tree);
        
        setListeners();
    }
    
    // calculate the tree of courses (i.e. which courses go to which row)
    function calculateCourseTree(courses) {
        rows = [[]];
        // preprocess data by placing all courses at the top
        for (var i = 0; i < courses.length; i++) {
            courses[i].row = 0;
            rows[0].push(courses[i]);
        }
        
        // recursively move the course's prereqs (and sub-prereqs)
        // one row below current row
        var tries = MAX_TRIES;
        do {
            var i = 0;
            do {
                eachPrereqInRow(rows, i, function(course) {
                    if (course.row < i + 1) {
                        moveCourseToRow(rows, course, i + 1, true, true);
                    }
                });
                i++;
            } while (rows[i] && rows[i].length > 0);
            tries--;
        } while (// until no change has occured
            !isValidTree(rows) && tries > 0);
        
        if (tries <= 0) console.error(
            "Failed to complete; diagram may be inaccurate.");
        
        // organize all of the rows
        // most important courses to the left
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
    
    // output tree as divs
    function displayTree(tree) {
        // display course blocks
        const LEFT_OFFSET = 10;
        $(".row, .line").remove();
        for (var i = tree.length - 1; i >= 0; i--) {
//        for (var i = 0; i < tree.length; i++) {
            var $row = $(document.createElement("div"));
            $row.addClass("row")
                .css("left", ((tree.length - i) * LEFT_OFFSET) + "px");
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
                var dependStr = "Dependancies:\n";
                var dependants = getDependants(tree, course);
                for (var k = 0; k < dependants.length; k++) {
                    dependStr += dependants[k].name
                        + ((k !== dependants.length - 1) ? " AND\n" : "");
                }
                if (k === 0) dependStr += "None";
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
                        borderStyle: (or) ? "dashed" : "solid"
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
    }
    
    // ensure that all prereqs of a course appear above the course
    // and that coreqs are on the same line
    function isValidTree(tree) {
        for (var i = 0; i < tree.length; i++) {
            for (var j = 0; j < tree[i].length; j++) {
                var course = tree[i][j];
                // check prereqs
                var returnValue = true;
                eachPrereqInCourse(tree, course,
                                   function(prereq, isCoPrereq) {
                    if (prereq.row <= course.row) {
                        returnValue = false;
                    }
                });
                if (returnValue === false) {
                    return false;
                }
                // check coreqs
                for (var k = 0; k < course.coreqs.length; k++) {
                    var coreq = findCourseByID(tree, course.coreqs[k]);
                    if (coreq.row !== course.row) {
                        return false;
                    }
                }
            }
        }
        return true;
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
                return arrayContains(array[i], value);
            }
        }
        return false;
    }
    
    // function to move course down to a specified row
    // moves the course and all prerequisites underneath it recursively
    function moveCourseToRow(rows, course, row, prereqs, coreqs) {
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
        
        // move all of the course's corequisites, too
        if (coreqs) {
            if (course.coreqs.length > 0) {
                var coreqs = [course];
                for (var j = 0; j < course.coreqs.length; j++) {
                    coreqs.push(findCourseByID(
                        rows, course.coreqs[j]));
                }
                for (var j = 0; j < coreqs.length; j++) {
                    moveCourseToRow(rows, coreqs[j], row, true, false);
                }
            }
        }
        
        // move all of the course's prerequisites, too
        if (prereqs) {
            eachPrereqInCourse(rows, course, function(prereq) {
                moveCourseToRow(rows, prereq, row + 1, true, true);
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