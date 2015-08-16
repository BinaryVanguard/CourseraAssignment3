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

var shape_selection = "cone";

var next_object_id = 1; //treat zero as an invalid id;
var world_objects = [];

var zoom = 10;

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

function buildTransform() {
    return {
        pos: [0, 0, 0],
        rot: [0, 0, 0],
        scale: 1    //uniform scaling only!
    }
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
    var sphere = { id: next_object_id++, type: "sphere" };
    sphere.transform = buildTransform();

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
    var cone = { id: next_object_id++, type: "cone" };
    cone.transform = buildTransform();

    cone.point = buildFan(origin, radius, height, longitude, color);
    cone.base = buildFan(origin, radius, 0, longitude, color);

    return cone;
}

function buildCylinder(origin, radius, height, latitude, longitude, color) {
    //build a fan
    //build another fan
    //build triangle strips
    var cylinder = { id: next_object_id++, type: "cylinder" };
    cylinder.transform = buildTransform();

    cylinder.top = buildFan(movePoint(origin, [0, height, 0]), radius, 0, longitude, color);
    cylinder.bottom = buildFan(origin, radius, 0, longitude, color);
    cylinder.sides = [];

    for(var i = 0; i < longitude; ++i)
        cylinder.sides.push(buildStrip( cylinder.bottom.points[i+1], cylinder.bottom.points[i+2], height, latitude, color));

    return cylinder;
}

function buildTetrahedron() {
    var tetrahedron = { id: next_object_id++, type: "tetrahedron" };
    tetrahedron.transform = buildTransform();

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

function hookupControls() {
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
        shape_selection = e.target.value;
    });

    var shape_add = document.getElementById("shape-add");
    shape_add.addEventListener("click", function (e) {
        var shape_list = document.getElementById("shape-list");

        var new_obj;
        switch(shape_selection) {
            case "cone":
                new_obj = buildCone(vec4(), 1, 5, 1, 20, [0, 0, 1, 1]);
                break;
            case "cylinder":
                new_obj = buildCylinder(vec4(), 1, 5, 1, 20, [0, 0, 1, 1]);
                break;
            case "sphere":
                new_obj = buildSphere(vec4(), 1, 20, 20, [0, 0, 1, 1]);
                break;
            case "tetrahedron":
                new_obj = buildTetrahedron();
                break;
            default:
                console.log("Failed to add object with type: " + shape_selection);
                break;
        }
        if (new_obj) {
            var option = document.createElement("option");
            option.innerHTML = new_obj.type;//.replace(/^[A-Z]*/, function (letter, index) { return letter.toUpperCase(); });
            option.value = new_obj.id;
            option.setAttribute("data-id", new_obj.id);
            shape_list.appendChild(option);

            world_objects.push(new_obj);
        }
    });

    var shape_del = document.getElementById("shape-del");
    shape_del.addEventListener("click", function (e) {
        var shape_list = document.getElementById("shape-list");
        var id = shape_list.value;

        if (id) {
            var toDelete;
            for (var i = 0; i < shape_list.children.length; ++i) {
                if (shape_list.children[i].value == id) {
                    toDelete = shape_list.children[i];
                    break;
                }
            }
            if (toDelete) {
                shape_list.removeChild(toDelete)
            } else {
                console.log("Failed to remove object with id " + id + " from object list.");
            }

            var index = -1;
            for (var i = 0; i < world_objects.length; ++i) {
                if (world_objects[i].id == id) {
                    index = i;
                    break;
                }                    
            }
            if (index >= 0) {
                world_objects.splice(index, 1);
            } else {
                console.log("Failed to remove object with id " + id + " from world object list.");
            }
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

    var chkPerspective = document.getElementById("chkPerspective");
    chkPerspective.addEventListener("change", function (e) {
        mPersp = e.target.checked 
            ? perspective(65, 1, 1, 1000)          
            : ortho(-10, 10, -10, 10, -1000, 1000);
    });

    var zoom_slider = document.getElementById("zoom");
    zoom_slider.addEventListener("change", function (e) {
        var new_zoom = parseInt(e.target.value);
        if (new_zoom) {
            var delta = zoom - new_zoom;
            var forward = normalize(subtract(cam.look, cam.pos));
            cam.pos = add(scale(delta, forward), cam.pos);
            zoom = new_zoom;
        }
        
    });
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

    mPersp = perspective(65, 1, 1, 1000);

    //var fan = buildFan(vec4(), 1, 20, [0, 0, 1, 1]);
    var cyl = buildCylinder(vec4(), 1, 5, 1, 20, [0, 0, 1, 1]);
    var cone = buildCone(vec4(), 1, 5, 1, 20, [0, 0, 1, 1]);
    var sphere = buildSphere(vec4(), 1, 20, 20, [0,0,1,1]);
    var tetrahedron = buildTetrahedron();

    function draw() {
        //var rot = rotate(.5, [0, 1, 0]);

        //var x = dot(rot[0], vec4(cam.pos));
        //var y = dot(rot[1], vec4(cam.pos));
        //var z = dot(rot[2], vec4(cam.pos));

        //cam.pos = [x, y, z];

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        for (var i = 0; i < world_objects.length; ++i) {
            switch (world_objects[i].type) {
                case "cone":
                    renderFan(cone.point, cone.transform);
                    renderFan(cone.base, cone.transform);
                    break;
                case "cylinder":
                    renderFan(cyl.top, cyl.transform);
                    renderFan(cyl.bottom, cyl.transform);
                    for (var i = 0; i < cyl.sides.length; ++i) renderStrip(cyl.sides[i], cyl.transform);
                    break;
                case "sphere":
                    renderFan(sphere.top, sphere.transform);
                    renderFan(sphere.bottom, sphere.transform);
                    for (var i = 0; i < sphere.sides.length; ++i) renderStrip(sphere.sides[i], sphere.transform);
                    break;
                case "tetrahedron":
                    renderTriangles(tetrahedron, tetrahedron.transform);
                    break;
                default:
                    console.log("Failed to render object with id: " + world_objects[i].id);
                    break;
            }
        }

        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    //render();

    hookupControls();
}

function renderStrip(strip, transform)
{
    var mCamera = lookAt(cam.pos, cam.look, cam.up);
    var rot = mult(y_rotation == 0 ? mat4() : rotate(y_rotation, [1, 0, 0]), mat4());
    mCamera = mult(mCamera, rot)
    mCamera = mult(mPersp, mCamera);

    //bake transform
    var tran = translate(transform.pos[0], transform.pos[1], transform.pos[2]);
    var rot_x = rotate(transform.rot[0], [1, 0, 0]);
    var rot_y = rotate(transform.rot[1], [0, 1, 0]);
    var rot_z = rotate(transform.rot[2], [0, 0, 1]);
    var scale = scalem(transform.scale, transform.scale, transform.scale);

    var l2w = mult(rot_z, scale);
    l2w = mult(rot_y, l2w);
    l2w = mult(rot_x, l2w);
    l2w = mult(tran, l2w);

    mCamera = mult(mCamera, l2w);

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

function renderFan(fan, transform)
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

function renderTriangles(triangles, transform)
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
