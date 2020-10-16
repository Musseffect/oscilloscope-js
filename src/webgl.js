class ShaderProgram{
    constructor(gl,vertexShader,fragmentShader,attributes){
        this.handle = gl.createProgram();
        gl.attachShader(this.handle, vertexShader.handle);
        gl.attachShader(this.handle, fragmentShader.handle);
        gl.linkProgram(this.handle);
        var success = gl.getProgramParameter(this.handle, gl.LINK_STATUS);
        if (!success) {
            console.log(gl.getProgramInfoLog(this.handle));
            gl.deleteProgram(this.handle);
            throw new Error("Failed to link program");
        }


        if(attributes)
        {
            Object.keys(attributes).forEach(function(key)
            {
                let item=attributes[key];
                gl.bindAttribLocation(this.handle,item,key);
            },this);
        }
        this.attributes={};
        const numAttribs = gl.getProgramParameter(this.handle, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < numAttribs; i++) {
            const attribInfo = gl.getActiveAttrib(this.handle, i);
            const location = gl.getAttribLocation(this.handle, attribInfo.name);
            this.attributes[attribInfo.name]=location;
        }
        this.uniforms={};
        const numUniforms = gl.getProgramParameter(this.handle, gl.ACTIVE_UNIFORMS);
        for(let i=0;i<numUniforms;i++)
        {
            const uniformInfo = gl.getActiveUniform(this.handle,i);
            const location = gl.getUniformLocation(this.handle,uniformInfo.name);
            this.uniforms[uniformInfo.name]={location:location,type:uniformInfo.type,value:null};
        }
    }
    use(gl)
    {
        gl.useProgram(this.handle);
    }
    setUniform(key,value)
    {
        try{
            this.uniforms[key].value=value;
        }catch(err)
        {
            console.log(err +" in setUniform() for key \""+ key+"\"");
        }
    }
    setUniforms(uniformsMap)
    {
        let self=this;
        Object.keys(uniformsMap).forEach(function(key)
        {
            try{
                self.uniforms[key].value=uniformsMap[key];
            }catch(err)
            {
                console.log(err +" in setUniforms() for key \""+ key+"\"");
            }
        });
    }
    getAttributeLocation(key)
    {
        return this.attributes[key];
    }
    bindUniform(gl,type,value,location)
    {
        switch(type)
        {
            case gl.FLOAT:
                gl.uniform1f(location,value);  
            break;
            case gl.FLOAT_VEC2:
                gl.uniform2fv(location,value);
                break;
            case gl.FLOAT_VEC3:
                gl.uniform3fv(location,value);
                break;
            case gl.FLOAT_VEC4:
                gl.uniform4fv(location,value);
                break;
            case gl.INT:
                gl.uniform1i(location,value);
                break;
            case gl.INT_VEC2:
                gl.uniform2iv(location,value);
                break;
            case gl.INT_VEC3:
                gl.uniform3iv(location,value);
                break;
            case gl.INT_VEC4:
                gl.uniform4iv(location,value);
                break;
            case gl.FLOAT_MAT2:
                gl.uniformMatrix2fv(location,false,value);
                break;
            case gl.FLOAT_MAT3:
                gl.uniformMatrix3fv(location,false,value);
                break;
            case gl.FLOAT_MAT4:
                gl.uniformMatrix4fv(location,false,value);
                break;
            case gl.SAMPLER_2D:
                gl.uniform1i(location,value);
                break;
        }
    }
    bindUniforms(gl)
    {
        let self=this;
        Object.keys(this.uniforms).forEach(function(key)
        {
            let uniform=self.uniforms[key];
            if(uniform.value!=null)
            {
                self.bindUniform(gl,uniform.type,uniform.value,uniform.location);
            }
        });
    }
    destroy(gl)
    {
        gl.deleteProgram(this.handle);
    }
}

class Shader{
    constructor(gl, type, source) {
        this.handle = gl.createShader(type);
        gl.shaderSource(this.handle, source);
        gl.compileShader(this.handle);
        var success = gl.getShaderParameter(this.handle, gl.COMPILE_STATUS);
        if (!success) {
            console.log(gl.getShaderInfoLog(this.handle));
            gl.deleteShader(this.handle);
            throw new Error("Failed to compile shader");
        }
    }
    destroy(gl){
        gl.deleteShader(this.handle);
    }
}

class Texture2D{
    constructor(gl,level,internalFormat,
        width,height,border,
        srcFormat,srcType,pixels,parameters){
        this.handle = gl.createTexture();
        this.width = width;
        this.height = height;
        gl.bindTexture(gl.TEXTURE_2D,this.handle);
        gl.texImage2D(gl.TEXTURE_2D,level,internalFormat,width,height,border,srcFormat,srcType,pixels);
        if(parameters!=undefined){
            parameters.forEach(function(item)
            {
                gl.texParameteri(gl.TEXTURE_2D,item.key,item.value);
            });
        }
    }
    bind(gl,unit)
    {
        if(unit)
            gl.activeTexture(gl.TEXTURE0+unit);
        gl.bindTexture(gl.TEXTURE_2D,this.handle);
    }
    destroy(gl)
    {
        gl.deleteTexture(this.handle);
    }
}
class FBO{
    constructor(gl,texture,attachment,texTarget,level){
        this.handle = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER,this.handle);
        if(texture){
            gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, texTarget, texture.handle, level);
            let status; 
            if(!((status = gl.checkFramebufferStatus(gl.FRAMEBUFFER))==gl.FRAMEBUFFER_COMPLETE))
            {
                console.log("Framebuffer status: " + status);
                throw new Error("Error during framebuffer's texture attaching");
            }
        }
    }
    attach(texture,attachment,texTarget,level){
        gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, texTarget, texture.handle, level);
        let status; 
        if(!((status = gl.checkFramebufferStatus(gl.FRAMEBUFFER))==gl.FRAMEBUFFER_COMPLETE))
        {
            console.log("Framebuffer status: " + status);
            throw new Error("Error during framebuffer's texture attaching");
        }
    }
    use(gl){
        gl.bindFramebuffer(gl.FRAMEBUFFER,this.handle);
    }
    static useDefault(gl){
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    destroy(gl)
    {
        gl.deleteFramebuffer(this.handle);
    }
}