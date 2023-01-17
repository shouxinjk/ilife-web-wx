// 文档加载完毕后执行
$(document).ready(function ()
{
    //根据屏幕大小计算字体大小
    const oHtml = document.getElementsByTagName('html')[0]
    const width = oHtml.clientWidth;
    var rootFontSize = 12 * (width / 1440);// 在1440px的屏幕基准像素为12px
    rootFontSize = rootFontSize <8 ? 8:rootFontSize;//最小为8px
    rootFontSize = rootFontSize >16 ? 16:rootFontSize;//最大为18px
    oHtml.style.fontSize = rootFontSize+ "px";   
 
    //处理参数
    var args = getQuery();
    var id = args["id"];//当前内容

    //根据ID加载开白请求
    loadCandidateRequest(id);

    //注册事件
    $("#rejected").click(function(){
        changeForwardRequestStatus(id,"rejected");
    });
    $("#approved").click(function(){
        changeForwardRequestStatus(id,"ready");
    });

});

//根据id查询得到开白请求
function loadCandidateRequest(id){
    $.ajax({
        url:app.config.sx_api+"/mod/categoryBroker/rest/badge/"+id,
        type:"get",        
        success:function(data){
            console.log("got candidate detail.",data);
            if(data){//有数据则显示到界面
                $("#name").text(data.name);
                $("#badge").text(data.badge.name);
                $("#company").text(data.company);
                $("#job").text(data.job);
                $("#description").text(data.description);
                $("#requestTime").text(data.createDate);

                //回应信息：用于重新打开时
                if(data.status=='pending'){
                    $("#respondType").text("待回应");
                    $("#respondBtns").css("display","block");
                    $("#respondTips").css("display","none");                    
                }else if(data.status=='rejected'){
                    $("#respondType").text("已拒绝");
                    $("#respondTime").text(data.updateDate);
                    $("#respondBtns").css("display","none");
                    $("#respondTips").css("display","block");
                }else if(data.status=='ready'){
                    $("#respondType").text("已通过");
                    $("#respondTime").text(data.updateDate);
                    $("#respondBtns").css("display","none");
                    $("#respondTips").css("display","block");                    
                }else{
                    //do nothing
                }                

            }else{//否则提示
                siiimpleToast.message('糟糕，好像出错了，麻烦联系我们~~',{
                      position: 'bottom|center'
                    });  
            }
        }
    }) 
}

//修改开白请求状态
function changeForwardRequestStatus(id,status){
    $.ajax({
        url:app.config.sx_api+"/mod/categoryBroker/rest/status",
        type:"post",     
        data:JSON.stringify({
            id: id,
            status: status
        }),  
        headers:{
            "Content-Type":"application/json",
            "Accept": "application/json"
        },          
        success:function(res){
            console.log("got forward detail.",res);
            if(res.success){//结束，跳转到文章列表页面
                window.location.href = window.location.href;//刷新页面                 
            }else{//否则提示
                siiimpleToast.message('糟糕，好像出错了，麻烦联系我们~~',{
                      position: 'bottom|center'
                    });  
            }
        }
    }) 
}

//显示操作按钮：对于已经rejected approved的显示灰色，并显示结果。否则显示高亮操作
function showButtons(enable){
    if(enable){//显示为可操作状态
        //保持不变
    }else{
        $("#rejected").attr("disabled","disabled");
        $("#approvedByArticle").attr("disabled","disabled");
        $("#approvedByAccount").attr("disabled","disabled");
        $("#respondTips").css("display","block");
    }
}
