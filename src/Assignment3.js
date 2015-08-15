"use strict";

var canvas;
var gl;

var points = [];
var colors = [];

var program;
var wireframe_program;

var vertBufferId;
var colorBufferId;

var cam;    // frame of reference ... used to calc mv-matrix
var mPersp; //Perspective... just a name.. could actually be ortho

var y_rotation = 0;

var bFillPolygon = true;
var bDrawWireframe = true;

function rotatePoint(p, r) {
    var x = dot(r[0], vec4(p));
    var y = dot(r[1], vec4(p));
    var z = dot(r[2], vec4(p));
    var w = dot(r[3], vec4(p));
    return [x, y, z, w];
}

function movePoint(p, t) {
    var x = p[0] + t[0];
    var y = p[1] + t[1];
    var z = p[2] + t[2];
    return [x, y, z, 1];
}


function buildFan(middle, radius, height, segments, color) {
    var points = [];
    var tip = movePoint(middle, [0, height, 0]);
    points.push(tip);
    middle = movePoint(middle, [0, 0, radius]);
    //middle[2] += radius;

    points.push(middle);
    
    var circ_Seg = (360 / segments); //we have already pushed the first outside point

    var rot = rotate(circ_Seg, [0, 1, 0]);  //always create fans around the Y axis

    for(var i = 0; i < segments; ++i){
        middle = rotatePoint(middle, rot);
        points.push(middle);
    }

    var colors = [];
    for (var i = 0; i < points.length; ++i)
        colors.push(color);

    return { points: points, colors: colors };
}

function buildStrip(first, second, height, sections, color) {
    var points = [];

    points.push(first);
    points.push(second);
    
    var increment = height / sections;

    for (var i = 0; i < sections; ++i) {
        first = movePoint(first, [0, increment, 0]);
        second = movePoint(second, [0, increment, 0]);
        points.push(first);
        points.push(second);
    }

    var colors = []
    for (var i = 0; i < points.length; ++i)
        colors.push(color);

    return { points: points, colors: colors };
}

function buildSphere(origin, radius, latitude, longitude, color) {
    var sphere = {};
    sphere.top = buildFan(movePoint(origin, vec3(0, radius * 2)), radius, 0, longitude, color);
    sphere.bottom = buildFan(origin, radius, 0, longitude, color);
    sphere.sides = [];
    if (latitude > 2)
        for (var i = 0; i < longitude; ++i)
            sphere.sides.push(buildStrip(sphere.bottom.points[i + 1], sphere.bottom.points[i + 2], radius * 2, latitude - 2, color));
    
    var center = vec4(origin);
    center[1] += radius;
    
    for (var i = 0; i < sphere.top.points.length; ++i) {
        
        //console.log("Center: " + center.toString());
        //console.log("Radius: " + radius.toString());
        //console.log("Point: " + sphere.top.points[i].toString());
        //console.log("Point - Center: " + subtract(sphere.top.points[i], center));
        //console.log("Length: " + length(subtract(sphere.top.points[i], center)));
        //console.log("Ratio: " + (radius / length(subtract(sphere.top.points[i], center))));
        //console.log("New Point: " + scale(radius / length(subtract(sphere.top.points[i], center)), sphere.top.points[i]));

        var delta = subtract(sphere.top.points[i], center);
        var ratio = radius / length(delta);

        sphere.top.points[i] = movePoint(scale(ratio, delta), center);
        //sphere.top.points[i][3] = 1; move point will reset W
    }
    
    for (var i = 0; i < sphere.bottom.points.length; ++i) {
        var delta = subtract(sphere.bottom.points[i], center);
        var ratio = radius / length(delta)
        sphere.bottom.points[i] = movePoint(scale(ratio, delta), center);
        //sphere.bottom.points[i][3] = 1; move point will reset W
    }
    for (var i = 0; i < sphere.sides.length; ++i)
        for (var j = 0; j < sphere.sides[i].points.length; ++j) {
            var delta = subtract(sphere.sides[i].points[j], center);
            var ratio = radius / length(delta);
            sphere.sides[i].points[j] = movePoint(scale(ratio, delta), center);
            //sphere.sides[i].points[j] = scale(radius / length(subtract(sphere.sides[i].points[j], center)), sphere.sides[i].points[j]);
            //sphere.sides[i].points[j][3] = 1; move point will reset W
        }
    //console.log(sphere.top.points);
    //console.log(sphere.bottom.points);
    //console.log(sphere.sides.points);

    return sphere;
}

function buildCone(origin, radius, height, latitude, longitude, color) {
    //build two fans
    var cone = {};
    cone.point = buildFan(origin, radius, height, longitude, color);
    cone.base = buildFan(origin, radius, 0, longitude, color);

    return cone;
}

function buildCylinder(origin, radius, height, latitude, longitude, color) {
    //build a fan
    //build another fan
    //build triangle strips
    var cylinder = {};
    cylinder.top = buildFan(movePoint(origin, [0, height, 0]), radius, 0, longitude, color);
    cylinder.bottom = buildFan(origin, radius, 0, longitude, color);
    cylinder.sides = [];

    for(var i = 0; i < longitude; ++i)
        cylinder.sides.push(buildStrip( cylinder.bottom.points[i+1], cylinder.bottom.points[i+2], height, latitude, color));

    return cylinder;
}

function buildTetrahedron() {
    var tetrahedron = {};

    tetrahedron.points = [];

    tetrahedron.points.push([-.5, 0, 0, 1]);
    tetrahedron.points.push([.5, 0, 0, 1]);
    tetrahedron.points.push([0, 1, 0, 1]);

    tetrahedron.points.push([.5, 0, 0, 1]);
    tetrahedron.points.push([0, 0, -1, 1]);
    tetrahedron.points.push([0, 1, 0, 1]);

    tetrahedron.points.push([0, 0, -1, 1]);
    tetrahedron.points.push([-.5, 0, 0, 1]);
    tetrahedron.points.push([0, 1, 0, 1]);

    tetrahedron.points.push([0, 0, -1, 1]);
    tetrahedron.points.push([-.5, 0, 0, 1]);
    tetrahedron.points.push([.5, 0, 0, 1]);

    tetrahedron.colors = [];

    tetrahedron.colors.push([0, 1, 0, 1.0]);
    tetrahedron.colors.push([0, 1, 0, 1.0]);
    tetrahedron.colors.push([0, 1, 0, 1.0]);

    tetrahedron.colors.push([1, 0, 0, 1.0]);
    tetrahedron.colors.push([1, 0, 0, 1.0]);
    tetrahedron.colors.push([1, 0, 0, 1.0]);

    tetrahedron.colors.push([0, 0, 1, 1.0]);
    tetrahedron.colors.push([0, 0, 1, 1.0]);
    tetrahedron.colors.push([0, 0, 1, 1.0]);

    tetrahedron.colors.push([0, 0, 0, 1.0]);
    tetrahedron.colors.push([0, 0, 0, 1.0]);
    tetrahedron.colors.push([0, 0, 0, 1.0]);

    return tetrahedron;
}


window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    if (!canvas) {
        alert("Canvas not found");
        return;
    }

    gl = WebGLUtils.setupWebGL(canvas, {preserveDrawingBuffer: true});
    if (!gl) {
        alert("WebGL isn't available");
        return;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    wireframe_program = initShaders(gl, "vertex-shader", "wireframe-shader");

    vertBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, 1000, gl.DYNAMIC_DRAW);
   
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    colorBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, 1000, gl.DYNAMIC_DRAW);
    
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertBufferId);
    var vWirePosition = gl.getAttribLocation(wireframe_program, "vPosition");
    gl.vertexAttribPointer(vWirePosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vWirePosition);

    cam = {};
    cam.pos = ([0, 0, 10 ]);
    //cam.pos = [-0, 0, 1000000];      // WHERE THE EYE IS AT IN SPACE, A POINT
    cam.look =  [0, 0, 0];    // THE LOOK AT VECTOR
    cam.up =  [0, 1, 0];      // THE UP VECTOR


    mPersp = ortho(-10, 10, -10, 10, -1000, 1000);
    //mPersp = perspective(65, 1, 1, 1000);

    //var fan = buildFan(vec4(), 1, 20, [0, 0, 1, 1]);
    //points = fan.points;
    //colors = fan.colors;

    var cyl = buildCylinder(vec4(), 1, 5, 1, 20, [0, 0, 1, 1]);
    //points = cyl.bottom.points;
    //colors = cyl.bottom.colors;

    var cone = buildCone(vec4(), 1, 5, 1, 20, [0, 0, 1, 1]);


    var sphere = buildSphere(vec4(), 1, 20, 20, [0,0,1,1]);

    var tetrahedron = buildTetrahedron();

    function draw() {
        var rot = rotate(.5, [0, 1, 0]);

        var x = dot(rot[0], vec4(cam.pos));
        var y = dot(rot[1], vec4(cam.pos));
        var z = dot(rot[2], vec4(cam.pos));

        cam.pos = [x, y, z];

        //render();


        //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        //renderFan(cyl.top);
        //renderFan(cyl.bottom);
        //for (var i = 0; i < cyl.sides.length; ++i) renderStrip(cyl.sides[i]);

        //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        //renderFan(cone.point);
        //renderFan(cone.base);

        //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        //renderFan(sphere.top);
        //renderFan(sphere.bottom);
        //for (var i = 0; i < sphere.sides.length; ++i) renderStrip(sphere.sides[i]);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        renderTriangles(tetrahedron);

        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    //render();

    var shape_select = document.getElementById("shape-select");
    shape_select.addEventListener("change", function (e) {
        switch (e.target.value) {
            case "cone":
                break;
            case "cylinder":
                break;
            case "sphere":
                break;
            case "tetrahedron":
                break;
            default:
                alert(e.target.value);
                break;
        }
    });

    var y_slider = document.getElementById("y-rotation");
    y_slider.addEventListener("change", function (e) {
        y_rotation = parseInt(e.target.value);
    });

    var chkFilled = document.getElementById("chkFilled");
    chkFilled.addEventListener("change", function (e) {
        bFillPolygon = e.target.checked;
    });

    var chkWireframe = document.getElementById("chkWireframe");
    chkWireframe.addEventListener("change", function (e) {
        bDrawWireframe = e.target.checked;
    });
}

function renderStrip(strip)
{
    var mCamera = lookAt(cam.pos, cam.look, cam.up);
    var rot = mult(y_rotation == 0 ? mat4() : rotate(y_rotation, [1, 0, 0]), mat4());
    mCamera = mult(mCamera, rot)
    mCamera = mult(mPersp, mCamera);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertBufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(strip.points));

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(strip.colors));

    if (bFillPolygon) {
        gl.useProgram(program);

        var u_mMVP = gl.getUniformLocation(program, "mMVP");
        gl.uniformMatrix4fv(u_mMVP, false, flatten(mCamera));

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, strip.points.length);
    }

    if (bDrawWireframe) {
        gl.useProgram(wireframe_program);

        var u_mMVP = gl.getUniformLocation(wireframe_program, "mMVP");
        gl.uniformMatrix4fv(u_mMVP, false, flatten(mCamera));

        var u_fColor = gl.getUniformLocation(wireframe_program, "fColor");
        gl.uniform4fv(u_fColor, [0, 0, 0, 1]);

        //if it's a fan frame then we shouldn't draw the first point
        gl.drawArrays(gl.LINE_STRIP, 0, strip.points.length);
    }
}

function renderFan(fan)
{
    var mCamera = lookAt(cam.pos, cam.look, cam.up);
    var rot = mult(y_rotation == 0 ? mat4() : rotate(y_rotation, [1, 0, 0]), mat4());
    mCamera = mult(mCamera, rot)
    mCamera = mult(mPersp, mCamera);
        
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(fan.points));

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(fan.colors));

    if (bFillPolygon) {
        gl.useProgram(program);

        var u_mMVP = gl.getUniformLocation(program, "mMVP");
        gl.uniformMatrix4fv(u_mMVP, false, flatten(mCamera));

        gl.drawArrays(gl.TRIANGLE_FAN, 0, fan.points.length);
    }

    if (bDrawWireframe) {
        gl.useProgram(wireframe_program);

        var u_mMVP = gl.getUniformLocation(wireframe_program, "mMVP");
        gl.uniformMatrix4fv(u_mMVP, false, flatten(mCamera));

        var u_fColor = gl.getUniformLocation(wireframe_program, "fColor");
        gl.uniform4fv(u_fColor, [0, 0, 0, 1]);

        //if it's a fan frame then we shouldn't draw the first point
        gl.drawArrays(gl.LINE_STRIP, 1, fan.points.length-1);
    }
}

function renderTriangles(triangles)
{
    var mCamera = lookAt(cam.pos, cam.look, cam.up);
    //mCamera = mult(translate(0,0,-.5), mCamera);

    var rot = mult(y_rotation == 0 ? mat4() : rotate(y_rotation, [1, 0, 0]), mat4());//rotate(, [1, 0, 0]));
    mCamera = mult(mCamera, rot)
    //var mCamera = mult(rot, transpose(translate(0, 0, 1)));

    //var mCamera = translate(0, 0, y_rotation - 10);
    
    mCamera = mult(mPersp, mCamera);
    //mCamera = transpose(mCamera);
    //mCamera = mult(mCamera, transpose(mPersp));
   
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(triangles.points));

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(triangles.colors));

    //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (bFillPolygon) {
        gl.useProgram(program);

        var u_mMVP = gl.getUniformLocation(program, "mMVP");
        gl.uniformMatrix4fv(u_mMVP, false, flatten(mCamera));

        gl.drawArrays(gl.TRIANGLES, 0, triangles.points.length);
        //gl.drawArrays(gl.TRIANGLE_FAN, 0, triangles.points.length);
    }

    if (bDrawWireframe) {
        gl.useProgram(wireframe_program);

        var u_mMVP = gl.getUniformLocation(wireframe_program, "mMVP");
        gl.uniformMatrix4fv(u_mMVP, false, flatten(mCamera));

        var u_fColor = gl.getUniformLocation(wireframe_program, "fColor");
        gl.uniform4fv(u_fColor, [0, 0, 0, 1]);

        //if it's a fan frame then we shouldn't draw the first point
        gl.drawArrays(gl.LINE_STRIP, 0, triangles.points.length);
    }
}
