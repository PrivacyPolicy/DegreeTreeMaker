var jsonData = {};
var rows = [[]];
const DEBUG = true;
const HIDE_SINGLES = true;

$(function() {
    
//    var jsonData = {};
    // TODO provide way of changing this at the beginning
    var major = "Computer Science & Information Technology, B.S.";
    var conc = "Information Assurance & Cyber Security";
    
    $.ajax({
        url: "output.json",
        dataType: "json",
        data: null,
        success: function(data, textStatus, jqXHR) {
            console.log("Loaded JSON just fine: %o", data);
            jsonData = data;
            init();
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.error("Failed to load JSON: " + errorThrown);
        }
    });
    
    function init() {
        // initialize the data
        var courses = jsonData[major][conc];
        
//        var prereqIDs = [];
//        for (var i = 0; i < courses.length; i++) {
//            
//        }
//        if (HIDE_SINGLES) {
//            for (var i = courses.length - 1; i >= 0; i--) {
//                console.log(c);
//                var c = courses[i];
//                if (c.coreq.length === 0 && c.prereqs.length === 0) {
//                    courses.splice(i, 1);
//                }
//            }
//        }
        
        // calculate the tree
        var tree = calculateCourseTree(courses);
        
        // display course blocks
//        for (var i = tree.length - 1; i >= 0; i--) {
        for (var i = 0; i < tree.length; i++) {
            var $row = $(document.createElement("div"));
            $row.addClass("row");
            for (var j = 0; j < tree[i].length; j++) {
                var course = tree[i][j];
                $row.append("<div class=course id="
                            + course.id + ">" + course.name
                            + "</div>");
            }
            $(document.body).append($row);
        }
        
            
        // display lines from courses to their prereqs
        for (var i = 0; i < tree.length; i++) {
            for (var j = 0; j < tree[i].length; j++) {
                var $from = $("#" + tree[i][j].id);
                var fromX = $from.offset().left + $from.width() / 2 + parseInt($from.css("padding"));
                var fromY = $from.offset().top + $from.height() + parseInt($from.css("padding")) * 2;
                eachPrereqInCourse(tree, tree[i][j], function(prereq) {
                    var $to = $("#" + prereq.id);
                    var toX = $to.offset().left + $to.width() / 2 + parseInt($to.css("padding"));
                    var toY = $to.offset().top;
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
                        width: width + "px"
                    });
//                    console.log(prereq.id);
                    if (DEBUG) {
//                        console.log(fromX + ", " + fromY);
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
//        console.log(rows);
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
        
        return rows;
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
            var prereq = findCourseByID(rows, course.prereqs[i]);
            if (prereq) {
                callback(prereq);
            }
        }
    }
});