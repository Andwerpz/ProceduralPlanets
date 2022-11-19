#version 330 core
layout (location = 0) out vec4 gPosition;
layout (location = 1) out vec4 gNormal;
layout (location = 2) out vec4 gSpecular;
layout (location = 3) out vec4 gColor;
layout (location = 4) out vec4 gColorID;

in vec3 frag_pos;
in vec2 frag_uv;
in vec3 frag_colorID;
in mat3 TBN;

in vec3 planet_pos;

in vec4 frag_material_diffuse;
in vec4 frag_material_specular;
in float frag_material_shininess;

uniform vec3 view_pos;
uniform sampler2D tex_diffuse;
uniform sampler2D tex_specular;
uniform sampler2D tex_normal;
uniform sampler2D tex_displacement;
uniform bool enableParallaxMapping;

vec2 ParallaxMapping(vec2 texCoords, vec3 viewDir)
{ 
	float height_scale = 0.2;
    //float height =  texture(tex_displacement, texCoords).r;    
    //vec2 p = viewDir.xy / viewDir.z * (height * height_scale);
    //return texCoords - p;    
    
    // number of depth layers
    const float numLayers = 8;
    // calculate the size of each layer
    float layerDepth = 1.0 / numLayers;
    // depth of current layer
    float currentLayerDepth = 0.0;
    // the amount to shift the texture coordinates per layer (from vector P)
    vec2 P = viewDir.xy * height_scale; 
    vec2 deltaTexCoords = P / numLayers;
    
    // get initial values
	vec2  currentTexCoords     = texCoords;
	float currentDepthMapValue = texture(tex_displacement, currentTexCoords).r;
	  
	while(currentLayerDepth < currentDepthMapValue)
	{
	    // shift texture coordinates along direction of P
	    currentTexCoords -= deltaTexCoords;
	    // get depthmap value at current texture coordinates
	    currentDepthMapValue = texture(tex_displacement, currentTexCoords).r;  
	    // get depth of next layer
	    currentLayerDepth += layerDepth;  
	}
	
	// get texture coordinates before collision (reverse operations)
	vec2 prevTexCoords = currentTexCoords + deltaTexCoords;
	
	// get depth after and before collision for linear interpolation
	float afterDepth  = currentDepthMapValue - currentLayerDepth;
	float beforeDepth = texture(tex_displacement, prevTexCoords).r - currentLayerDepth + layerDepth;
	 
	// interpolation of texture coordinates
	float weight = afterDepth / (afterDepth - beforeDepth);
	vec2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0 - weight);
	
	return finalTexCoords; 
} 

vec4 scaleWithMaterial(vec4 color, vec4 material) {
	vec4 ans = vec4(0);
	ans.x = color.r * material.r;
	ans.y = color.g * material.g;
	ans.z = color.b * material.b;
	ans.w = color.a * material.a;
	return ans;
}

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

/* discontinuous pseudorandom uniformly distributed in [-0.5, +0.5]^3 */
vec3 random3(vec3 c) {
	float j = 4096.0*sin(dot(c,vec3(17.0, 59.4, 15.0)));
	vec3 r;
	r.z = fract(512.0*j);
	j *= .125;
	r.x = fract(512.0*j);
	j *= .125;
	r.y = fract(512.0*j);
	return r-0.5;
}

/* skew constants for 3d simplex functions */
const float F3 =  0.3333333;
const float G3 =  0.1666667;

/* 3d simplex noise */
float simplex3d(vec3 p) {
	 /* 1. find current tetrahedron T and it's four vertices */
	 /* s, s+i1, s+i2, s+1.0 - absolute skewed (integer) coordinates of T vertices */
	 /* x, x1, x2, x3 - unskewed coordinates of p relative to each of T vertices*/
	 
	 /* calculate s and x */
	 vec3 s = floor(p + dot(p, vec3(F3)));
	 vec3 x = p - s + dot(s, vec3(G3));
	 
	 /* calculate i1 and i2 */
	 vec3 e = step(vec3(0.0), x - x.yzx);
	 vec3 i1 = e*(1.0 - e.zxy);
	 vec3 i2 = 1.0 - e.zxy*(1.0 - e);
	 	
	 /* x1, x2, x3 */
	 vec3 x1 = x - i1 + G3;
	 vec3 x2 = x - i2 + 2.0*G3;
	 vec3 x3 = x - 1.0 + 3.0*G3;
	 
	 /* 2. find four surflets and store them in d */
	 vec4 w, d;
	 
	 /* calculate surflet weights */
	 w.x = dot(x, x);
	 w.y = dot(x1, x1);
	 w.z = dot(x2, x2);
	 w.w = dot(x3, x3);
	 
	 /* w fades from 0.6 at the center of the surflet to 0.0 at the margin */
	 w = max(0.6 - w, 0.0);
	 
	 /* calculate surflet components */
	 d.x = dot(random3(s), x);
	 d.y = dot(random3(s + i1), x1);
	 d.z = dot(random3(s + i2), x2);
	 d.w = dot(random3(s + 1.0), x3);
	 
	 /* multiply d by w^4 */
	 w *= w;
	 w *= w;
	 d *= w;
	 
	 /* 3. return the sum of the four surflets */
	 return dot(d, vec4(52.0));
}

void main()
{
	mat3 invTBN = transpose(TBN);

	//parallax mapping done in tangent space
	vec3 tangentViewPos = TBN * view_pos;	
	vec3 tangentFragPos = TBN * frag_pos;

	//offset texture coordinates with parallax mapping
	vec3 viewDir = normalize(tangentViewPos - tangentFragPos);
	vec2 texCoords = frag_uv;
	if(enableParallaxMapping){
		texCoords = ParallaxMapping(frag_uv, viewDir);
	}
	
	//calculate normal
	vec4 fragColor = texture(tex_diffuse, texCoords);
	vec3 normal = texture(tex_normal, texCoords).xyz;
	normal = normal * 2.0 - 1.0;
	normal = normalize(invTBN * normal);	//transform normal into world space
	
	if(fragColor.w == 0.0){	//alpha = 0
    	discard;
   	}
   	
   	vec3 fromCenter = vec3(frag_pos - planet_pos);
   	float planet_radius = 20;
   	float elevation = length(fromCenter) - planet_radius;
   	elevation += elevation * simplex3d(frag_pos * 0.5) * 0.5;
   	
   	vec3 sandColor = vec3(242, 210, 169) / 255.0;
   	vec3 grassColor = (vec3(37, 135, 7) / 255.0) * (1.0 + simplex3d(frag_pos * 30) * 0.1 + simplex3d(frag_pos * 0.5) * 0.4);
   	vec3 dirtColor = vec3(70, 46, 26) / 255.0;
   	vec3 snowColor = vec3(255, 250, 250) / 255.0;
   	vec3 stoneColor = vec3(145, 142, 133) / 255.0;
   	
   	vec3 blendedColor = vec3(0);
   	
   	float sandElevation = 0;
   	float grassElevation = 0.1;
   	float snowStartElevation = 0.7f;
   	float snowElevation = 1;
   	
   	float dirtCliffElevation = 0.7;
   	float stoneCliffElevation = 0.9;
   	
   	if(elevation < sandElevation) {
   		blendedColor = sandColor;
   	}
   	else if(elevation < grassElevation) {
   		blendedColor = blendColors(sandColor, grassColor, sandElevation, grassElevation, elevation);
   	}
   	else if(elevation < snowStartElevation) {
   		blendedColor = grassColor;
   	}
   	else if(elevation < snowElevation) {
   		blendedColor = blendColors(grassColor, snowColor, snowStartElevation, snowElevation, elevation);
   	}
   	else {
   		blendedColor = snowColor;
   	}
   	
   	vec3 steepfaceColor = blendColors(dirtColor, stoneColor, dirtCliffElevation, stoneCliffElevation, elevation);
   	float steepness = dot(normal, normalize(fromCenter));
   	blendedColor = blendColors(steepfaceColor, blendedColor, 0.7, 0.75, steepness);
	
    gColor.rgba = vec4(vec3(blendedColor), 1);
    gPosition.rgb = frag_pos;
    gPosition.a = gl_FragCoord.z;
    gSpecular.rgb = vec3(0.1, 0.1, 0.1);
    gSpecular.a = frag_material_shininess;
    gNormal.rgb = normalize(normal);
    gColorID = vec4(frag_colorID / 255, 1);
} 

