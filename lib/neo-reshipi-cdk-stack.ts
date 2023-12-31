import {
  //後で使うものもまとめてインポート
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  StackProps,
}from 'aws-cdk-lib';

import{
  Code,
  Function,
  FunctionUrlAuthType,
  Runtime,
}from "aws-cdk-lib/aws-lambda"

import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment,Source } from "aws-cdk-lib/aws-s3-deployment";  
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class NeoReshipiCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    //--S3のバケット作成
    const nuxt3Bucket = new Bucket(this, "nuxt3Bucket" ,{
      //リソース削除時の挙動を制御。スタックを削除するとバケットも削除
      //だだしバケットの中身があるときはautoDeleteObjectsが true出ないと削除できない
      removalPolicy:RemovalPolicy.DESTROY,
      autoDeleteObjects:true
    });  

    //--S3へ静的コンテンツをdeployment
    new BucketDeployment(this,"nuxt3BucketDeployment",{
      //バケットにアップする対象を指定
      sources:[Source.asset("../neo-reshipi/.output/public")],
      //デプロイ先のバケットを指定
      destinationBucket:nuxt3Bucket,
      //ログを保持する期間を指定
      logRetention: RetentionDays,ONE_MONTH,
    });

    //lambda関数の定義
    const lambda = new Function(this,"nitro",{
      //実行環境を指定
      runtime:Runtime.NODEJS_18_X,
      //lambda関数としてアップロードする関数のディレクトリを指定
      code:Code.fromAsset("../portfolio-nuxt3/.output/server"),
      //実行させる関数の名前をファイル名込みで指定
      handler:"index.handler",
      //タイムアウト時間を指定
      timeoiut:Duration.seconds(5),
      //メモリーサイズを指定
      memorySize:2048,
      //ログの保持を指定
      logRetention:RetentionDays,ONE_MONTH,
    });
    //定義したコンストラクトをaddFunctonUrlでlambda関数URLを定義
    const functionUrl = lambda.addFunctionUrl({
      //認証を必要としないのでNONEを指定
      authType:FunctionUrlAuthType.NONE,
    })
    



  }
}
