var jsonData = {};
var rows = [[]];
const DEBUG = true;

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
        
        // calculate the tree
        var tree = calculateCourseTree(courses);
        
        // print out the results to the user
        for (var i = tree.length - 1; i >= 0; i--) {
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
        console.log(rows);
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
        var i = 0;
        do {
            eachPrereqInRow(rows, i, function(course) {
                if (course.row < i + 1) {
                    moveCourseToRow(rows, course, i + 1);
                }
            });
            i++;
        } while (rows[i] && rows[i].length > 0);
        
        // find all co-requisites and add them back where they belong
        // for all that have a co-requisite
        //   select co-requisites of said course
        //   find out which has the lowest tree position
        //   move them all to the lowest row
        
        return rows;
    }
    
    // function to move course down to a specified row
    // moves the course and all prerequisites underneath it recursively
    function moveCourseToRow(rows, course, row) {
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
        eachPrereqInCourse(rows, course, function(prereq) {
            moveCourseToRow(rows, prereq, row + 1);
        });
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