const PointRenderer = (function(){
	const vertexShaderSource = `#version 300 es


	layout (location=0)in vec2 position;
	layout (location=1)in vec4 color;
	layout (location=2)in vec2 center;
	
	
	out vec3 fColor;
	out float fSigma;
	out vec2 fPosition;
	
	void main(){
		fColor = color.xyz;
		fSigma = color.w;
		fPosition = position*fSigma*3.;
		gl_Position = vec4(fPosition + center,0.,1);
	}`;
	const fragmentShaderSource = `#version 300 es
	#define PI 3.1415926535898
	precision highp float;

	in vec3 fColor;
	in float fSigma;
	in vec2 fPosition;

	out vec4 color;

	float pointIntensity(vec2 pos,float sigma){
		float f = 1./sigma;
		return exp(-dot(pos,pos)*f*f*0.5)*f/sqrt(2.*PI);
	}

	void main(){
		color.xyz = fColor*pointIntensity(fPosition,fSigma);
		color.w = 1.0;
	}
	`;
	let bufferData = [];
	let pointBuffer;
	let quad = {buffer:null,vao:null};
	let gl = null;
	let program;
	let pointCounter = 0;
	let viewport = {x:-1,y:-1,w:2,h:2};
	return {
	init:function(_gl){
		gl = _gl;
		pointBuffer = gl.createBuffer();
		quad.buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);
		gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(
			[-1,1,
			-1,-1,
			1,1,
			1,-1]),gl.STATIC_DRAW);
		quad.vao = gl.createVertexArray();
		gl.bindVertexArray(quad.vao);
		gl.enableVertexAttribArray(0);
		var size = 2;          
		var type = gl.FLOAT;   
		var normalize = false; 
		var stride = 0;   
		var offset = 0;  
		gl.vertexAttribPointer(
			0, size, type, normalize, stride, offset);
		var vertexShader = new Shader(gl, gl.VERTEX_SHADER, vertexShaderSource);
		var fragmentShader = new Shader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
		program = new ShaderProgram(gl, vertexShader, fragmentShader);

	},
	viewport:function(x,y,w,h){
		viewport.x = x;
		viewport.y = y;
		viewport.w = w;
		viewport.h = h;
	},
	clear:function(){
		bufferData = [];
		pointCounter = 0;
	},
	addPoint:function(pos,color,sigma){
		bufferData.push(color[0]);
		bufferData.push(color[1]);
		bufferData.push(color[2]);
		bufferData.push(sigma);
		bufferData.push((pos[0]-viewport.x)/viewport.w*2-1);
		bufferData.push((pos[1]-viewport.y)/viewport.h*2-1);
		pointCounter++;
	},
	renderFrame:function(){
		if(bufferData.length>0){

			program.use(gl);
			gl.bindVertexArray(quad.vao);
			gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bufferData), gl.DYNAMIC_DRAW);
			
			gl.enableVertexAttribArray(1);
			gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 6*4, 0);
			gl.vertexAttribDivisor(1, 1);
			gl.enableVertexAttribArray(2);
			gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 6*4, 4*4);
			gl.vertexAttribDivisor(2, 1);

			gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,pointCounter);
		}
	}
};

})();
