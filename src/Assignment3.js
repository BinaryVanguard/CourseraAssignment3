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
    cam.pos = ([0, 0, 1 ]);
    //cam.pos = [-0, 0, 1000000];      // WHERE THE EYE IS AT IN SPACE, A POINT
    cam.look =  [0, 0, 0];    // THE LOOK AT VECTOR
    cam.up =  [0, 1, 0];      // THE UP VECTOR


    mPersp = ortho(-1, 1, -1, 1, -10, 1000);
    //mPersp = perspective(65, 1, 1, 1000);

    points.push([-.5, 0, 0, 1]);
    points.push([.5, 0, 0, 1]);
    points.push([0, 1, 0, 1]);
    
    points.push([.5, 0, 0, 1]);
    points.push([0, 0, -1, 1]);
    points.push([0, 1, 0, 1]);

    points.push([0, 0, -1, 1]);
    points.push([-.5, 0, 0, 1]);
    points.push([0, 1, 0, 1]);
    
    points.push([0, 0, -1, 1]);
    points.push([-.5, 0, 0, 1]);
    points.push([.5, 0, 0, 1]);
    
    colors.push([0, 1, 0, 1.0]);
    colors.push([0, 1, 0, 1.0]);
    colors.push([0, 1, 0, 1.0]);

    colors.push([1, 0, 0, 1.0]);
    colors.push([1, 0, 0, 1.0]);
    colors.push([1, 0, 0, 1.0]);

    colors.push([0, 0, 1, 1.0]);
    colors.push([0, 0, 1, 1.0]);
    colors.push([0, 0, 1, 1.0]);

    colors.push([0, 0, 0, 1.0]);
    colors.push([0, 0, 0, 1.0]);
    colors.push([0, 0, 0, 1.0]);

    function draw() {
        var rot = rotate(.5, [0, 1, 0]);

        var x = dot(rot[0], vec4(cam.pos));
        var y = dot(rot[1], vec4(cam.pos));
        var z = dot(rot[2], vec4(cam.pos));

        cam.pos = [x, y, z];
        render();
        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    //render();

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



function render()
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
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(points));

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(colors));

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (bFillPolygon) {
        gl.useProgram(program);

        var u_mMVP = gl.getUniformLocation(program, "mMVP");
        gl.uniformMatrix4fv(u_mMVP, false, flatten(mCamera));

        gl.drawArrays(gl.TRIANGLES, 0, points.length);
    }

    if (bDrawWireframe) {
        gl.useProgram(wireframe_program);

        var u_mMVP = gl.getUniformLocation(wireframe_program, "mMVP");
        gl.uniformMatrix4fv(u_mMVP, false, flatten(mCamera));

        var u_fColor = gl.getUniformLocation(wireframe_program, "fColor");
        gl.uniform4fv(u_fColor, [0, 0, 0, 1]);

        gl.drawArrays(gl.LINE_STRIP, 0, points.length);
    }
}
