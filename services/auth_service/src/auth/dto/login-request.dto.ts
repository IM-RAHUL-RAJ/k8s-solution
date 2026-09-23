import {
  IsNotEmpty,
  IsString,
  MaxLength
} from 'class-validator';


export class LoginRequestDto {

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;


  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}