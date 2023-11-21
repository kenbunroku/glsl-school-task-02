precision mediump float;

uniform sampler2D textureUnit0;
uniform sampler2D textureUnit1;
uniform float ratio;

varying vec2 vTexCoord;

void main() {
    vec4 samplerColor0 = texture2D(textureUnit0, vTexCoord);
    vec4 samplerColor1 = texture2D(textureUnit1, vTexCoord);

    vec4 color = mix(samplerColor0, samplerColor1, ratio);

    gl_FragColor = color;
}
