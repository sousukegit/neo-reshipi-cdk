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
      removalPolicy:RemovalPolicy.DESTROY,
      autoDeleteObjects:true
    });  

    //--S3へ静的コンテンツをdeployment
    new BucketDeployment(this,"nuxt3BucketDeployment",{
      sources:[Source.asset("../neo-reshipi/.output/public")],
      destinationBucket:nuxt3Bucket,
      logRetention: RetentionDays,ONE_MONTH,
    });
  }
}
