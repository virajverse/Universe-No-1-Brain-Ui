uniform vec3 viewVector;
uniform float c;
uniform float p;
uniform float uTime;
uniform vec2 uMouse;
uniform float uFadeTime;
attribute vec2 aDelayDuration;
attribute float size;
varying float intensity;
varying float alpha;
uniform float uAlpha;
uniform bool isCustomAlpha;

void main()
{
    if(uFadeTime > 0.00001){

    vec3 vNormal = normalize( normalMatrix * normal );
	vec3 vNormel = normalize( normalMatrix * viewVector );
	intensity = pow( c - dot(vNormal, vNormel), p );

    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

    // Smooth organic pulse wave instead of rapid digital flickering
    alpha = 0.3 + 0.7 * sin(uTime * 3.0 + (position.x + position.y) / 50.0);

    if( isCustomAlpha ) {
        alpha = uAlpha;
    }

    // Elegant depth-attenuated size multiplier (fixes flat giant dots)
    gl_PointSize = size * 1.8 * ( 300.0 / -mvPosition.z );

    gl_Position = projectionMatrix * mvPosition;

   }

}