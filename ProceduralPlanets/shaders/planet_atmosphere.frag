#version 330 core
layout (location = 0) out vec4 lColor;

uniform sampler2D tex_position;
uniform sampler2D tex_color;
uniform sampler2D tex_frag_dir;

uniform vec3 camera_pos;
uniform vec3 planet_pos;
uniform float planet_radius;
uniform float atmosphere_radius;

uniform vec3 sunLightDir;

in vec2 frag_uv;

const float PI = 3.14159265;

vec3 blendColors(vec3 minColor, vec3 maxColor, float min, float max, float x) {
	if(x < min) {
		return minColor;
	}
	else if(x > max) {
		return maxColor;
	}
	float minWeight = (max - x) / (max - min);
	float maxWeight = (x - min) / (max - min);
	float r = minColor.r * minWeight + maxColor.r * maxWeight;
	float g = minColor.g * minWeight + maxColor.g * maxWeight;
	float b = minColor.b * minWeight + maxColor.b * maxWeight;
	return vec3(r, g, b);
}

float atan2(float x, float y) {
	bool s = (abs(x) > abs(y));
	return mix(PI / 2.0 - atan(x, y),  atan(y, x), s);
}

mat3 createXRotMatrix(float rad) {
	return mat3(
		1, 0, 0,
		0, cos(rad), sin(rad),
		0, -sin(rad), cos(rad)
	);
}

mat3 createYRotMatrix(float rad) {
	return mat3(
		cos(rad), 0, -sin(rad),
		0, 1, 0,
		sin(rad), 0, cos(rad)
	);
}

//returns the length of intersection between a ray and a sphere
float raySphereLength(vec3 rayOrigin, vec3 rayDir, vec3 spherePos, float sphereRadius) {
	vec3 rayToSphere = spherePos - rayOrigin;
	vec3 toClosestPoint = rayDir * dot(rayDir, rayToSphere);
	float sphereRayDist = length(spherePos - (rayOrigin + toClosestPoint));
	
	if(sphereRayDist > sphereRadius){
		//they don't intersect
		return 0;
	}	
	
	float intersectionDistRadius = sqrt(sphereRadius * sphereRadius - sphereRayDist * sphereRayDist);
	
	vec3 toNear = toClosestPoint - rayDir * intersectionDistRadius;
	vec3 toFar = toClosestPoint + rayDir * intersectionDistRadius;
	
	float distToNear = dot(toNear, rayDir);
	float distToFar = dot(toFar, rayDir);
	
	distToNear = max(distToNear, 0);
	distToFar = max(distToFar, 0);
	
	return distToFar - distToNear;
}

const float densityFalloff = 10;

float densityAtPoint(vec3 densitySamplePoint) {
	float heightAboveSurface = length(densitySamplePoint - planet_pos) - planet_radius;
	float height01 = heightAboveSurface / (atmosphere_radius - planet_radius);
	float localDensity = exp(-height01 * densityFalloff) * (1.0 - height01);
	return localDensity;
}

const int numOpticalDepthPoints = 10;

float opticalDepth(vec3 rayOrigin, vec3 rayDir, float rayLength) {
	vec3 densitySamplePoint = rayOrigin;
	float stepSize = rayLength / (numOpticalDepthPoints - 1);
	float opticalDepth = 0;
	for(int i = 0; i < numOpticalDepthPoints; i++){
		float localDensity = densityAtPoint(densitySamplePoint);
		opticalDepth += localDensity * stepSize;
		densitySamplePoint += rayDir * stepSize;
	}
	return opticalDepth;
}

const int numInScatteringPoints = 10;

const float scatteringStrength = 20;
const float scatteringBase = 400.0;
const float scatterR = pow(scatteringBase / 700, 4) * scatteringStrength;
const float scatterG = pow(scatteringBase / 530, 4) * scatteringStrength;
const float scatterB = pow(scatteringBase / 460, 4) * scatteringStrength;
const vec3 scatteringCoefficients = vec3(scatterR, scatterG, scatterB);

vec3 calculateLight(vec3 rayOrigin, vec3 rayDir, float rayLength, vec3 originalCol) {
	rayDir = normalize(rayDir);
	vec3 inScatterPoint = rayOrigin;
	float stepSize = rayLength / (numInScatteringPoints - 1);
	vec3 inScatteredLight = vec3(0);
	float viewRayOpticalDepth = 0;
	
	for(int i = 0; i < numInScatteringPoints; i++){
		float sunRayLength = raySphereLength(inScatterPoint, -sunLightDir, planet_pos, atmosphere_radius);
		float sunRayOpticalDepth = opticalDepth(inScatterPoint, -sunLightDir, sunRayLength);
		viewRayOpticalDepth = opticalDepth(rayOrigin, rayDir, stepSize * i);
		vec3 transmittance = exp(-(sunRayOpticalDepth + viewRayOpticalDepth) * scatteringCoefficients);
		float localDensity = densityAtPoint(inScatterPoint);
		 
		inScatteredLight += localDensity * transmittance * stepSize * scatteringCoefficients;
		inScatterPoint += rayDir * stepSize;
	}
	
	float originalColTransmittance = exp(-viewRayOpticalDepth);
	return originalCol * originalColTransmittance + inScatteredLight;
}

void main() {
	vec4 frag_color = texture(tex_color, frag_uv);
	vec3 frag_dir = normalize(texture(tex_frag_dir, frag_uv).rgb);
	vec4 frag_pos = texture(tex_position, frag_uv).rgba;
	
	//figure out if the ray intersects the sphere at all
	vec3 cameraToSphere = planet_pos - camera_pos;
	vec3 toClosestPoint = frag_dir * dot(frag_dir, cameraToSphere);
	
	float sphereRayDist = length(planet_pos - (camera_pos + toClosestPoint));
	
	if(sphereRayDist > atmosphere_radius) {
		discard;
	}
	
	float intersectDiskRadius = sqrt(atmosphere_radius * atmosphere_radius - sphereRayDist * sphereRayDist);
	
	vec3 toWaterNear = toClosestPoint - frag_dir * intersectDiskRadius;
	vec3 toWaterFar = toClosestPoint + frag_dir * intersectDiskRadius;
	
	vec3 waterNear = camera_pos + toClosestPoint - frag_dir * intersectDiskRadius;
	vec3 waterFar = camera_pos + toClosestPoint + frag_dir * intersectDiskRadius;
	vec3 waterNormal = normalize(waterNear - planet_pos);
	
	float distToNear = dot(toWaterNear, frag_dir);
	float distToFar = dot(toWaterFar, frag_dir);
	float distToSurface = dot(frag_pos.rgb - camera_pos, frag_dir);
	
	//check if sphere is intersected behind the camera
	if(distToNear < 0 && distToFar < 0) {
		discard;
	}
	
	distToNear = max(distToNear, 0);	//clamp near dist to camera, it usually can be behind the camera
	distToFar = max(distToFar, 0);
	
	float atmosphereDepth = raySphereLength(camera_pos, frag_dir, planet_pos, atmosphere_radius);
	if(frag_color.a != 0) {
		atmosphereDepth = distToSurface - distToNear;
	}
	
	if(atmosphereDepth < 0){
		discard;
	}
	
	float epsilon = 0.0001;
	lColor.rgb = calculateLight(camera_pos + frag_dir * (distToNear + epsilon), frag_dir, atmosphereDepth - 2 * epsilon, frag_color.rgb);
	lColor.a = 1;
} 

