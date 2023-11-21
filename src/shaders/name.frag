precision mediump float;

uniform sampler2D textureUnit0;
uniform sampler2D textureUnit1;

varying vec2 texCoords;
varying float vRatio;
varying float vAlpha;

void main() {
    vec4 samplerColor0 = texture2D(textureUnit0, texCoords);
    vec4 samplerColor1 = texture2D(textureUnit1, texCoords);

    vec4 color = mix(samplerColor0, samplerColor1, vRatio);

    gl_FragColor = vec4(color.rgb, color.a * vAlpha);
}
