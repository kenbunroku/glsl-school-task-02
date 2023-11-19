attribute vec2 position1;
attribute vec2 position2;

uniform mat4 mvpMatrix;

void main() {
    gl_Position = mvpMatrix * vec4(position1, 0.0, 1.0);
    gl_PointSize = 2.0;
}
