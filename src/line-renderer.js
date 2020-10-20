const LineRenderer = (function(){
	const vertexShaderSource = `#version 300 es

    #define ROT(a) mat2(cos(a),-sin(a),sin(a),cos(a))

	layout (location=0)in vec2 position;
	layout (location=1)in vec4 color;//color_sigma
    layout (location=2)in vec4 center;//center angle distance
    layout (location=3)in vec2 ab;
    
	out vec3 fColor;
    out float fSigma;
    out float fDist;
	out vec2 fPosition;
	
	void main(){
		fColor = color.xyz*mix(ab.x,ab.y,position.x*0.5+0.5);
        fSigma = color.w;
        fDist = center.w;
        fPosition = position*vec2(fSigma*4.+fDist*0.5,4.*fSigma)+vec2(fDist*0.5,0.0);
		gl_Position = vec4(ROT(-center.z)*fPosition + center.xy,0.,1.);
	}`;
	const fragmentShaderSource = `#version 300 es
	#define PI 3.1415926535898
	precision highp float;

	in vec3 fColor;
    in float fSigma;
    in float fDist;
	in vec2 fPosition;

    out vec4 color;
    
    //Error function
    float erf(float x)
    {
        float s = sign(x), a = abs(x);
        x = 1.0 + (0.278393 + (0.230389 + 0.078108 * (a * a)) * a) * a;
        x *= x;
        return s - s / (x * x);
    }
    //Simplified formula
    float intensity(vec2 p,float d,float sigma)
    {
        float f = 1.0/(sqrt(2.)*sigma);
        return (erf(p.x*f)-erf((p.x-d)*f))
        *exp(-p.y*p.y*f*f)/(2.*d);
    }
	float pointIntensity(vec2 pos,float sigma){
		float f = 1.0/sigma;
		return exp(-dot(pos,pos)*f*f*0.5)*f/sqrt(2.*PI);
    }
	void main(){
        color.xyz = fColor*(fDist>0.0001?intensity(fPosition,fDist,fSigma):pointIntensity(fPosition,fSigma));
        color.w = 1.0;
	}
	`;
    let bufferData = [];
	let pointBuffer;
	let gl = null;
	let program;
	let quad = {buffer:null,vao:null};
	let lineCounter = 0;
	let viewport = {x:-1,y:-1,w:2,h:2};
    function transformPoint(p){
        return [
            (p[0]-viewport.x)/viewport.w*2-1,
            (p[1]-viewport.y)/viewport.h*2-1
        ];
    }

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
		clear:function(){
			bufferData = [];
            lineCounter = 0;
        },
		addLine:function(p1,p2,color,sigma,a,b){
            bufferData.push(color[0]);
            bufferData.push(color[1]);
            bufferData.push(color[2]);
            bufferData.push(sigma);
            let _p1 = transformPoint(p1);
            let _p2 = transformPoint(p2);
            let l = Math.sqrt(Math.pow(_p1[0]-_p2[0],2)+Math.pow(_p1[1]-_p2[1],2));
            bufferData.push(_p1[0]);
            bufferData.push(_p1[1]);
            bufferData.push(l<0.001?0:Math.atan2(_p2[1]-_p1[1],_p2[0]-_p1[0]));
            bufferData.push(l);
            bufferData.push(a);
            bufferData.push(b);
            lineCounter++;
		},
		viewport:function(x,y,w,h){
			viewport.x = x;
			viewport.y = y;
			viewport.w = w;
			viewport.h = h;
		},
		renderFrame:function(){
            if(bufferData.length>0){
    
                program.use(gl);
                gl.bindVertexArray(quad.vao);
                gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bufferData), gl.DYNAMIC_DRAW);
                
                gl.enableVertexAttribArray(1);
                gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 10*4, 0);
                gl.vertexAttribDivisor(1, 1);
                gl.enableVertexAttribArray(2);
                gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 10*4, 4*4);
                gl.vertexAttribDivisor(2, 1);
                gl.enableVertexAttribArray(3);
                gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 10*4, 8*4);
                gl.vertexAttribDivisor(3, 1);
    
                gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,lineCounter);
            }
		}
	}

})();