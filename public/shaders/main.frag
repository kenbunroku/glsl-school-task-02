precision highp float;

varying float vAlpha;
varying float vRatio;

void main() {
    float vRatio2 = 1.0 - abs(vRatio * 2.0 - 1.0);
    if(vRatio2 > 0.1 && distance(gl_PointCoord, vec2(0.5, 0.5)) > 0.5) {
        discard;
    }

    gl_FragColor = vec4(0.0, 0.0, 0.0, vAlpha);
}
