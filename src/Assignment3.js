"use strict";

var canvas;
var gl;

var points = [];
var colors = [];

var vertBufferId;
var colorBufferId;

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

    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    vertBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, 16, gl.DYNAMIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    colorBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, 32, gl.DYNAMIC_DRAW);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    render();
}


function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBufferId);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(points));

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBufferId);
    //gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten([redComponent, greenComponent, blueComponent, 1.0, redComponent, greenComponent, blueComponent, 1.0]));
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten([1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 0.0, 1.0]));

    gl.drawArrays(gl.LINE_STRIP, 0, points.length /  2);
}
