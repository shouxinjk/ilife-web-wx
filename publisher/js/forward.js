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
    loadForwardRequest(id);

    //注册事件
    $("#rejected").click(function(){
        changeForwardRequestStatus(id,"rejected");
    });
    $("#approvedByArticle").click(function(){
        changeForwardRequestStatus(id,"approved");
    });
    $("#approvedByAccount").click(function(){
        changeForwardRequestStatus(id,"approved");
    });

});

//根据id查询得到开白请求
function loadForwardRequest(id){
    $.ajax({
        url:app.config.sx_api+"/wx/wxForward/rest/request/"+id,
        type:"get",        
        success:function(res){
            console.log("got forward detail.",res);
            if(res.success){//有数据则显示到界面
                var data = res.data;
                $("#requester").text(data.requester.nickname);
                $("#requestAccountName").text(data.requestAccount.name);
                $("#requestAccountId").text(data.requestAccount.originalId);
                $("#requestAccountDesc").text(data.requestAccount.description);

                $("#requestTime").text(data.createDate);
                //开白内容
                if(data.subjectType=='account'){
                    $("#requestTitle").text("公众号 "+data.account.name);
                    $("#rejected").css("display","inline-block");//拒绝按钮
                    $("#approvedByAccount").css("display","inline-block");//仅在有公众号时才显示全局开白
                }else if(data.subjectType=='article'){
                    $("#requestTitle").html("<a href='"+data.article.url+"'>"+data.article.title+"</a>");
                    $("#rejected").css("display","inline-block");//拒绝按钮
                    $("#approvedByArticle").css("display","inline-block");//仅在有文章时才显示单篇开白
                }else{
                    //do nothing
                }
                //开白类型
                if(data.type=='account'){
                    $("#requestType").text("全局开白");
                }else if(data.type=='article'){
                    $("#requestType").text("单篇文章开白");
                }else{
                    //do nothing
                }
                //回应信息：用于重新打开时
                if(data.status=='pending'){
                    $("#respondType").text("待回应");
                }else if(data.status=='rejected'){
                    $("#respondType").text("已拒绝");
                    $("#respondTime").text(data.updateDate);
                    $("#respondBtns").css("display","none");
                    $("#respondTips").css("display","block");
                }else if(data.status=='approved'){
                    $("#respondType").text("已开白");
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
        url:app.config.sx_api+"/wx/wxForward/rest/requests/"+id+"/"+status,
        type:"put",     
        data:JSON.stringify({}),   
        success:function(res){
            console.log("got forward detail.",res);
            if(res.success){//结束，跳转到文章列表页面
                //更新当前页面上回应状态
                if(status=='pending'){
                    $("#respondType").text("待回应");
                }else if(status=='rejected'){
                    $("#respondType").text("已拒绝");
                    $("#respondTime").text("刚刚");
                }else if(status=='approved'){
                    $("#respondType").text("已开白");
                    $("#respondTime").text("刚刚");
                }else{
                    //do nothing
                } 

                //修改按钮状态
                showButtons(false);
                //提示
                siiimpleToast.message('已回应，申请者将立即收到通知~~',{
                      position: 'bottom|center'
                    });                  
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
