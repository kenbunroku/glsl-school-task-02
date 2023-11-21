attribute vec2 nPosition;
attribute vec2 texCoord;

uniform mat4 mvpMatrix;

varying vec2 vTexCoord;

void main() {
    vTexCoord = texCoord;
    gl_Position = mvpMatrix * vec4(nPosition, 0.0, 1.0);
}
